import { ReactNative } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { waitFor } from "@shared/lib/waitFor";
import { rawFind, rawFindByName } from "@shared/lib/rawFind";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import { editHistory, fakedMessages } from "./fluxIntercept";

const TAG = "[MessageLogger]";

function textNode(text: string) {
    return { content: text, type: "text" };
}

// Confirmed live via the decompiled Discord bundle: Discord's own "(edited)" tag isn't a plain text
// node - it's colored through a dedicated `editedColor` field on the row that only applies to ONE
// tag per row, which our per-history-entry tags can't use (there can be several, one per past
// version). role-color-everywhere already found the workaround for coloring arbitrary text nodes on
// this bridge: wrap the node in a `{type: "link", target: "usernameOnClick", ...}` shell and set a
// `linkColor` inside it - text nodes themselves don't support a color field, but this wrapper does.
// TEXT_MUTED is the same semantic token Discord's own muted/secondary text (timestamps, the real
// edited tag) uses, confirmed live: resolves to #8a8a9a on this build's theme.
function editedTagNode() {
    const color = resolveSemanticColorSafe(["TEXT_MUTED"], "#949BA4");
    return {
        type: "link",
        target: "usernameOnClick",
        context: {
            username: 1,
            usernameOnClick: {
                action: "0",
                userId: "0",
                linkColor: ReactNative.processColor(color),
                messageChannelId: "0",
            },
            medium: true,
        },
        content: [textNode(" (edited)")],
    };
}

// message.content in the row JSON is an array of {content, type} rich-text nodes, not a plain
// string (confirmed live). Old versions get their own muted-colored "(edited)" tag stacked above
// the current content - the current version keeps Discord's own native tag rather than getting a
// second one from here, since that already renders correctly on a genuinely-edited message with no
// help needed.
function applyEditHistory(message: any) {
    const history = editHistory.get(message.id);
    if (!history?.length) return;

    const currentContent: any[] = Array.isArray(message.content) ? message.content : [textNode(String(message.content ?? ""))];
    const nodes: any[] = [];
    for (const oldContent of history) {
        nodes.push(textNode(oldContent || "(empty)"));
        nodes.push(editedTagNode());
        nodes.push(textNode("\n"));
    }
    nodes.push(...currentContent);
    message.content = nodes;
}

// Confirmed live: whatever builds the row JSON sent across the native bridge only carries known
// schema fields through - a custom property set directly on the MessageRecord (confirmed present
// there via eval) never survives into row.message here. message.id does survive, though, so
// checking membership in fluxIntercept's own fakedMessages/editHistory maps (already tracked there
// for onUnload cleanup / log capture) works where a custom flag on the row itself can't.
function handleRow(row: any) {
    const message = row?.message;
    if (!message?.id) return;

    applyEditHistory(message);

    if (!fakedMessages.has(message.id)) return;

    message.edited = "deleted";
    message.textColor = ReactNative.processColor("#E4404380");
    row.backgroundHighlight ??= {};
    row.backgroundHighlight.backgroundColor = ReactNative.processColor("#da373c22");
    row.backgroundHighlight.gutterColor = ReactNative.processColor("#da373cff");
}

function patchJsonRows(target: any, cleanups: (() => void)[]): boolean {
    cleanups.push(
        before("updateRows", target, (args: any[]) => {
            try {
                const rows = JSON.parse(args[1]);
                for (const row of rows) handleRow(row);
                args[1] = JSON.stringify(rows);
            } catch {
                // Leave args untouched - better to show unstyled rows than break message loading.
            }
        }),
    );
    return true;
}

// Confirmed live via a raw scan of window.modules: on this build, NativeModules.DCDChatManager
// doesn't exist at all, and the legacy RowManager.prototype.generate this repo's shared patchRows
// helper falls back to is a real, patchable method that simply never receives calls for the
// screens that matter here - the actual native row-update bridge is instead exposed through an
// ordinary Metro module (found by its exact updateRows([native code]) signature, not by name,
// since its module id isn't stable across builds/sessions) that a richer "chat list controller"
// module (scrollTo/scrollToBottom/updateRows/clearRows/...) wraps and calls into. Verified by a
// live monkey-patch: real message JSON flowed through it on every send/delete.
function isNativeUpdateRows(m: any): boolean {
    return typeof m?.updateRows === "function" && m.updateRows.toString().includes("[native code]");
}

export function patchRowStyling(cleanups: (() => void)[]): boolean {
    const { NativeModules } = ReactNative;
    const DCDChatManager = NativeModules?.DCDChatManager;
    if (DCDChatManager?.updateRows) {
        return patchJsonRows(DCDChatManager, cleanups);
    }

    const immediate = rawFind<any>(isNativeUpdateRows);
    if (immediate) {
        return patchJsonRows(immediate, cleanups);
    }

    const handle = waitFor(
        () => rawFind<any>(isNativeUpdateRows),
        (target) => patchJsonRows(target, cleanups),
    );
    cleanups.push(() => handle.cancel());

    // Legacy fallback, kept in case a future build removes the native-bridge module entirely and
    // goes back to a real, callable RowManager.prototype.generate - harmless to attach alongside
    // the primary path above since handleRow is idempotent per row.
    const legacyHandle = waitFor(
        () => {
            const RowManager = rawFindByName<any>("RowManager");
            return RowManager?.prototype?.generate ? RowManager : undefined;
        },
        (RowManager) => {
            cleanups.push(after("generate", RowManager.prototype, (_args: any[], row: any) => {
                try { handleRow(row); } catch (e: any) { console.warn(TAG, "Row styling failed:", e?.message ?? e); }
            }));
        },
    );
    cleanups.push(() => legacyHandle.cancel());

    return true;
}
