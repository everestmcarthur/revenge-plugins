import { React } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import NoteBox from "./NoteBox";

const { FormSection, FormRow } = Forms;

export interface ListItem {
    key: string;
    label: string;
    subLabel?: string;
    onPress?: () => void;
}

/** A titled section listing tap-able rows, with a friendly note shown in place of an empty list. */
export default function ListSection({ title, items, emptyText }: { title: string; items: ListItem[]; emptyText: string }) {
    return (
        <FormSection title={title}>
            {items.length === 0 ? (
                <NoteBox>{emptyText}</NoteBox>
            ) : (
                items.map((item) => (
                    <FormRow key={item.key} label={item.label} subLabel={item.subLabel} onPress={item.onPress} />
                ))
            )}
        </FormSection>
    );
}
