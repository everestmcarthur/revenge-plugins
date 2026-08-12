import { React, ReactNative } from "@vendetta/metro/common";
import { TableRow, TableRowGroup } from "./table";
import NoteBox from "./NoteBox";

const { Text } = ReactNative;

export interface ListItem {
    key: string;
    label: string;
    subLabel?: string;
    onPress?: () => void;
}

// A titled section listing tap-able rows, with a friendly note shown in place of an empty list.
// Always pairs onPress with a visible trailing indicator - rows without one have been unreliable
// about registering taps.
export default function ListSection({ title, items, emptyText }: { title: string; items: ListItem[]; emptyText: string }) {
    return (
        <TableRowGroup title={title}>
            {items.length === 0 ? (
                <NoteBox>{emptyText}</NoteBox>
            ) : (
                items.map((item) => (
                    <TableRow
                        key={item.key}
                        label={item.label}
                        subLabel={item.subLabel}
                        onPress={item.onPress}
                        trailing={<Text style={{ color: "#F23F42", fontSize: 20, fontWeight: "700" }}>×</Text>}
                    />
                ))
            )}
        </TableRowGroup>
    );
}
