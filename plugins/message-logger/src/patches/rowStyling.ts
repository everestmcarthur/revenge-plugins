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

// Discord's own "(edited)" tag is colored via a dedicated `editedColor` row field that only applies
// once per row - no good for multiple per-history tags. Text nodes have no color field of their
// own, so this wraps the tag in the same `link`/`linkColor` trick role-color-everywhere uses.
// Takes the already-resolved processColor value instead of resolving it itself - resolving a
// semantic color is real work (walks the theme's token table), and a busy channel can call this
// hundreds of times per updateRows batch (once per history entry per edited row currently on
// screen) - resolving once per batch instead of once per node is the difference between that being
// free and it being a measurable chunk of every single row update.
function editedTagNode(processedColor: any) {
    return {
        type: "link",
        target: "usernameOnClick",
        context: {
            username: 1,
            usernameOnClick: {
                action: "0",
                userId: "0",
                linkColor: processedColor,
                messageChannelId: "0",
            },
            medium: true,
        },
        content: [textNode(" (edited)")],
    };
}

// message.content in the row JSON is an array of {content, type} rich-text nodes, not a plain
// string. Old versions get their own muted "(edited)" tag stacked above the current content, which
// keeps Discord's native tag since that already renders correctly on its own.
function applyEditHistory(message: any, editedColor: any) {
    const history = editHistory.get(message.id);
    if (!history?.length) return;

    const currentContent: any[] = Array.isArray(message.content) ? message.content : [textNode(String(message.content ?? ""))];
    const nodes: any[] = [];
    for (const oldContent of history) {
        nodes.push(textNode(oldContent || "(empty)"));
        nodes.push(editedTagNode(editedColor));
        nodes.push(textNode("\n"));
    }
    nodes.push(...currentContent);
    message.content = nodes;
}

// The row JSON sent across the native bridge only carries known schema fields - a custom property
// on the message never survives, but message.id does, so we check membership in fluxIntercept's
// own maps instead of a flag on the row itself.
function handleRow(row: any, editedColor: any, deletedTextColor: any, deletedBgColor: any, deletedGutterColor: any) {
    const message = row?.message;
    if (!message?.id) return;

    if (editHistory.size) applyEditHistory(message, editedColor);

    if (!fakedMessages.size || !fakedMessages.has(message.id)) return;

    message.edited = "deleted";
    message.textColor = deletedTextColor;
    row.backgroundHighlight ??= {};
    row.backgroundHighlight.backgroundColor = deletedBgColor;
    row.backgroundHighlight.gutterColor = deletedGutterColor;
}

function patchJsonRows(target: any, cleanups: (() => void)[]): boolean {
    cleanups.push(
        before("updateRows", target, (args: any[]) => {
            // Nothing tracked at all - skip the parse/stringify round-trip entirely rather than
            // paying for it on every single row update in every channel, faded or not.
            if (!editHistory.size && !fakedMessages.size) return;

            try {
                const editedColor = ReactNative.processColor(resolveSemanticColorSafe(["TEXT_MUTED"], "#949BA4"));
                const deletedTextColor = ReactNative.processColor("#E4404380");
                const deletedBgColor = ReactNative.processColor("#da373c22");
                const deletedGutterColor = ReactNative.processColor("#da373cff");

                const rows = JSON.parse(args[1]);
                for (const row of rows) handleRow(row, editedColor, deletedTextColor, deletedBgColor, deletedGutterColor);
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
