import { React, ReactNative as RN } from "@vendetta/metro/common";
import { findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

import SettingsScaffold from "@shared/ui/SettingsScaffold";
import NoteBox from "@shared/ui/NoteBox";
import ColorInput from "@shared/ui/ColorInput";
import { TableRow, TableRowGroup, TableSwitchRow, TextInput } from "@shared/ui/table";
import type { AntiedStorage } from "../lib/types";

const UserStore = findByStoreName("UserStore");
const { View, Text, TouchableOpacity, Image } = RN;

export default function Settings() {
    useProxy(storage);
    const cfg = storage as AntiedStorage;

    cfg.switches ??= {} as any;
    cfg.inputs ??= {} as any;
    cfg.colors ??= {} as any;
    cfg.misc ??= {} as any;

    const ignoredUsers = cfg.inputs.ignoredUserList || [];

    const handleRemoveUser = (id: string) => {
        cfg.inputs.ignoredUserList = ignoredUsers.filter((u) => u.id !== id);
        showToast("User removed from ignore list", getAssetIDByName("Check"));
    };

    return (
        <SettingsScaffold>
            <NoteBox>
                Cute Moodle (Antied) keeps deleted messages and edit history visible in your chat with customizable highlights, indicators, and long-press actionsheet tools.
            </NoteBox>

            <TableRowGroup title="General Logger">
                <TableSwitchRow
                    label="Log deleted messages"
                    subLabel="Keep deleted messages visible in chat"
                    value={!!cfg.switches.enableMD}
                    onValueChange={(v: boolean) => {
                        cfg.switches.enableMD = v;
                    }}
                />
                <TableSwitchRow
                    label="Log edited messages"
                    subLabel="Track edits and original message contents"
                    value={!!cfg.switches.enableMU}
                    onValueChange={(v: boolean) => {
                        cfg.switches.enableMU = v;
                    }}
                />
                <TableSwitchRow
                    label="Ignore bots"
                    subLabel="Do not log messages or edits from bot accounts"
                    value={!!cfg.switches.ignoreBots}
                    onValueChange={(v: boolean) => {
                        cfg.switches.ignoreBots = v;
                    }}
                />
                <TableSwitchRow
                    label="Ignore your own messages"
                    subLabel="Do not log your own deletions and edits"
                    value={!!cfg.switches.ignoreOwnMessages}
                    onValueChange={(v: boolean) => {
                        cfg.switches.ignoreOwnMessages = v;
                    }}
                />
            </TableRowGroup>

            <TableRowGroup title="Styling & Appearance">
                <TableSwitchRow
                    label="Minimalistic mode"
                    subLabel="Show simple indicators without heavy colored highlights"
                    value={!!cfg.switches.minimalistic}
                    onValueChange={(v: boolean) => {
                        cfg.switches.minimalistic = v;
                    }}
                />
                <TableSwitchRow
                    label="Use background highlight"
                    subLabel="Apply colored tint to deleted message backgrounds"
                    value={!!cfg.switches.useBackgroundColor}
                    onValueChange={(v: boolean) => {
                        cfg.switches.useBackgroundColor = v;
                    }}
                />
                {!cfg.switches.minimalistic && (
                    <>
                        <ColorInput
                            label="Text color"
                            value={cfg.colors.textColor || "#E40303"}
                            defaultValue="#E40303"
                            onChange={(hex: string) => {
                                cfg.colors.textColor = hex;
                            }}
                        />
                        {cfg.switches.useBackgroundColor && (
                            <ColorInput
                                label="Background highlight color"
                                value={cfg.colors.backgroundColor || "#FF2C2F"}
                                defaultValue="#FF2C2F"
                                onChange={(hex: string) => {
                                    cfg.colors.backgroundColor = hex;
                                }}
                            />
                        )}
                    </>
                )}
                <TableSwitchRow
                    label="Add timestamp for edits"
                    subLabel="Include relative timestamp on edited versions"
                    value={!!cfg.switches.addTimestampForEdits}
                    onValueChange={(v: boolean) => {
                        cfg.switches.addTimestampForEdits = v;
                    }}
                />
            </TableRowGroup>

            <TableRowGroup title="Custom Buffers">
                <TextInput
                    label="Deleted indicator text"
                    value={cfg.inputs.deletedMessageBuffer || "This message is deleted"}
                    onChange={(v: string) => {
                        cfg.inputs.deletedMessageBuffer = v;
                    }}
                />
                <TextInput
                    label="Edited prefix tag"
                    value={cfg.inputs.editedMessageBuffer || "`[ EDITED ]`"}
                    onChange={(v: string) => {
                        cfg.inputs.editedMessageBuffer = v;
                    }}
                />
            </TableRowGroup>

            <TableRowGroup title={`Ignored Users (${ignoredUsers.length})`}>
                {ignoredUsers.length === 0 ? (
                    <View style={{ padding: 16 }}>
                        <Text style={{ opacity: 0.6, fontSize: 13, color: "#96989d" }}>No users currently ignored.</Text>
                    </View>
                ) : (
                    ignoredUsers.map((u) => {
                        const user = UserStore?.getUser?.(u.id);
                        const name = user?.username ? `@${user.username}` : u.username || u.id;
                        return (
                            <TableRow
                                key={u.id}
                                label={name}
                                subLabel={`ID: ${u.id}`}
                                trailing={
                                    <TouchableOpacity onPress={() => handleRemoveUser(u.id)}>
                                        <Image
                                            source={getAssetIDByName("TrashIcon") || getAssetIDByName("ic_trash_24px")}
                                            style={{ width: 20, height: 20, tintColor: "#ff4d4d" }}
                                        />
                                    </TouchableOpacity>
                                }
                            />
                        );
                    })
                )}
            </TableRowGroup>
        </SettingsScaffold>
    );
}
