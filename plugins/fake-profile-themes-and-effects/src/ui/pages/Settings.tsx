import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import React from "react";
import { ScrollView } from "react-native";

import { FormSwitchRow } from "@fpte/ui/components/forms";
import { TableRadioGroup, TableRadioRow, TableRowGroup } from "@shared/ui/table";

export function Settings() {
    useProxy(storage);

    return (
        <ScrollView>
            <TableRowGroup title="Settings">
                <TableRadioGroup
                    title="Source to prioritize"
                    value={storage.prioritizeNitro ? "nitro" : "about_me"}
                    onChange={(value: string) => { storage.prioritizeNitro = value === "nitro"; }}
                >
                    <TableRadioRow label="Nitro" value="nitro" />
                    <TableRadioRow label="About Me" value="about_me" />
                </TableRadioGroup>
                <FormSwitchRow
                    label="Hide Builder"
                    subLabel="Hide the FPTE Builder in the User Profile and Server Profiles settings pages"
                    value={!!storage.hideBuilder}
                    onValueChange={value => { storage.hideBuilder = value; }}
                />
                <FormSwitchRow
                    label="Force fallback effect picker"
                    value={!!storage.forceFallbackEffectPicker}
                    onValueChange={value => { storage.forceFallbackEffectPicker = value; }}
                />
            </TableRowGroup>
        </ScrollView>
    );
}
