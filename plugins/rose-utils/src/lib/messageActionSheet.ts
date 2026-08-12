import { before, after } from "@vendetta/patcher";
import { findByProps } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";

// Injection technique ported from this repo's ViewRaw plugin. Generalized so multiple RoseUtils
// modules can share one openLazy patch instead of each patching it separately.
export interface MessageActionRow {
    key: string;
    label: string;
    sublabel?: string;
    icon?: string;
    onPress: (message: any) => void;
}

export type MessageActionBuilder = (message: any) => MessageActionRow[];

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");
const { ActionSheetRow } = findByProps("ActionSheetRow") ?? {};

const builders = new Set<MessageActionBuilder>();
let realUnpatch: (() => void) | null = null;

function buildRowElement(row: MessageActionRow, message: any) {
    if (!ActionSheetRow) return null;

    return React.createElement(ActionSheetRow, {
        label: row.label,
        subLabel: row.sublabel,
        icon: row.icon ? React.createElement(ActionSheetRow.Icon, { source: getAssetIDByName(row.icon) }) : undefined,
        onPress: () => {
            try {
                row.onPress(message);
            } finally {
                LazyActionSheet?.hideActionSheet?.();
            }
        },
        key: row.key,
    });
}

function collectRowElements(message: any) {
    const elements: any[] = [];
    for (const build of builders) {
        try {
            for (const row of build(message)) {
                const el = buildRowElement(row, message);
                if (el) elements.push(el);
            }
        } catch {
            // A broken builder shouldn't block anyone else's rows from showing up.
        }
    }
    return elements;
}

function patchOpenLazy(): () => void {
    return before("openLazy", LazyActionSheet, ([component, key, msg]: any[]) => {
        if (key !== "MessageLongPressActionSheet" || !msg?.message) return;

        component.then((instance: any) => {
            // Discord reuses the same lazy-loaded instance across opens - patch once, track the
            // active message on the instance itself.
            instance.__roseUtilsActiveMessage = msg.message;
            if (instance.__roseUtilsPatched) return;
            instance.__roseUtilsPatched = true;

            after("default", instance, (_: any, result: any) => {
                try {
                    const rows = collectRowElements(instance.__roseUtilsActiveMessage);
                    if (!rows.length) return;

                    // Real ActionSheetRow groups - search every group for one that already has
                    // ActionSheetRow-shaped children and insert there, falling back to a brand new
                    // group at the top if none match.
                    const groups = findInReactTree(
                        result,
                        (x: any) => Array.isArray(x) && x[0]?.type?.name === "ActionSheetRowGroup",
                    );

                    if (Array.isArray(groups) && groups.length && ActionSheetRow) {
                        let inserted = false;
                        for (const group of groups) {
                            const children = findInReactTree(
                                group,
                                (c: any) => Array.isArray(c) && c.some((child: any) => child?.type?.name === "ActionSheetRow"),
                            );
                            if (Array.isArray(children)) {
                                children.push(...rows);
                                inserted = true;
                                break;
                            }
                        }
                        if (!inserted && typeof groups.unshift === "function" && ActionSheetRow.Group) {
                            groups.unshift(React.createElement(ActionSheetRow.Group, {}, rows));
                            inserted = true;
                        }
                        if (inserted) return;
                    }

                    // Name-independent fallback: any array where every element already looks like
                    // an action sheet row (has both a label and an onPress).
                    const genericRowGroup = findInReactTree(
                        result,
                        (x: any) =>
                            Array.isArray(x) &&
                            x.length > 0 &&
                            x.every((el: any) => typeof el?.props?.label === "string" && typeof el?.props?.onPress === "function"),
                    );

                    if (Array.isArray(genericRowGroup)) genericRowGroup.push(...rows);
                } catch {
                    // Best-effort - if the action sheet shape doesn't match any known strategy,
                    // the extra rows just don't appear rather than crashing the sheet.
                }
            });
        });
    });
}

/**
 * Registers a row builder for the message long-press action sheet. Returns an unregister
 * function. The underlying openLazy patch is reference-counted across every caller - it's only
 * applied on the first registration and only removed once the last one unregisters, so modules
 * can start/stop independently of each other's registration order.
 */
export function registerMessageAction(builder: MessageActionBuilder): () => void {
    if (!realUnpatch && LazyActionSheet) realUnpatch = patchOpenLazy();
    builders.add(builder);

    return () => {
        builders.delete(builder);
        if (builders.size === 0 && realUnpatch) {
            realUnpatch();
            realUnpatch = null;
        }
    };
}
