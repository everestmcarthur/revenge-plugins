import { clipboard } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { Module, ModuleCategory } from "../../lib/Module";
import { decodeSnowflakeTimestamp } from "../../lib/snowflake";

function decodeSnowflake(id: string): string | null {
    return decodeSnowflakeTimestamp(id)?.toISOString() ?? null;
}

export default new Module({
    id: "snowflake-tools",
    label: "Snowflake Tools",
    meta: {
        sublabel: "Decode any Discord ID's creation timestamp - useful after copying an ID with Developer Mode",
        category: ModuleCategory.Useful,
    },
    settings: {
        decodeClipboard: {
            label: "Decode ID(s) in clipboard",
            subLabel: "Copy one or more Discord IDs first (one per line, or comma-separated), then tap this",
            type: "button",
            action() {
                clipboard.getString().then((text: string) => {
                    const ids = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
                    if (!ids.length) {
                        showToast("Clipboard is empty", undefined);
                        return;
                    }

                    const lines = ids.map((id) => {
                        const decoded = decodeSnowflake(id);
                        return decoded ? `${id} -> ${decoded}` : `${id} -> not a valid snowflake`;
                    });

                    const report = lines.join("\n");
                    clipboard.setString(report);
                    showToast(
                        `Decoded ${lines.length} ID${lines.length === 1 ? "" : "s"} - result copied`,
                        getAssetIDByName("ic_copy_24px"),
                    );
                });
            },
        },
    },
    handlers: {
        onStart() {},
        onStop() {},
    },
});
