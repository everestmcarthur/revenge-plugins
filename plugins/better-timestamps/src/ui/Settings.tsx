import { React, ReactNative, moment } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { TableRow, TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import SettingsScaffold from "@shared/ui/SettingsScaffold";
import { resolveSemanticColorSafe } from "@shared/lib/color";
import renderTimestamp, { TimestampMode } from "../lib/renderTimestamp";

const { Text } = ReactNative;

const MODES: { label: string; key: TimestampMode }[] = [
    { label: "Calendar", key: "calendar" },
    { label: "Relative", key: "relative" },
    { label: "ISO 8601", key: "iso" },
    { label: "Custom", key: "custom" }
];

export default function Settings() {
    useProxy(storage);

    return (
        <SettingsScaffold>
            <TableRowGroup title="Format">
                {MODES.map((mode) => {
                    const selected = storage.selected === mode.key;
                    let preview = "";
                    try { preview = renderTimestamp(moment(), mode.key); } catch { preview = ""; }

                    return (
                        <React.Fragment key={mode.key}>
                            <TableRow
                                label={mode.label}
                                subLabel={preview}
                                trailing={selected ? <Text style={{ fontSize: 16, color: resolveSemanticColorSafe(["TEXT_NORMAL", "TEXT_DEFAULT"], "#dbdee1") }}>✓</Text> : undefined}
                                onPress={() => { storage.selected = mode.key; }}
                            />
                            {mode.key === "custom" && selected && (
                                <TextInput
                                    label="Custom format (moment.js tokens)"
                                    placeholder="dddd, MMMM Do YYYY, h:mm:ss a"
                                    value={storage.customFormat}
                                    onChange={(v: string) => { storage.customFormat = v; }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </TableRowGroup>
            <TableRowGroup title="Layout">
                <TableSwitchRow
                    label="Always show name & avatar"
                    subLabel="Shows the username, avatar, and timestamp on every message instead of grouping consecutive messages"
                    value={!!storage.separateMessages}
                    onValueChange={(v: boolean) => { storage.separateMessages = v; }}
                />
            </TableRowGroup>
        </SettingsScaffold>
    );
}
