import React from "react";
import { View, Pressable, Image, StyleSheet } from "react-native";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { lazy } from "../lib/lazy";
import { rawFindByFunctionProps, rawFindByName } from "../lib/rawFind";
import { getFlux, getHaptic, getColorModule } from "../lib/commonModules";

const ICON = 48;

const ChatIcon = getAssetIDByName("ChatIcon");

// getFlux/getHaptic/getColorModule come from lib/commonModules.ts - see that file for the
// decoy-module writeup. The rest switch from eager, module-load-time findByProps/findByName (the
// caching finders, permanently wrong if they run before the target module registers) to lazy +
// raw variants. NavContext is findByProps("getGuildId") - a navigation-context helper, NOT the
// real guild data store (that one is reached via findByStoreName elsewhere in this plugin) -
// named accordingly here to avoid confusing the two.
const getChannelActions = lazy(() => rawFindByFunctionProps<any>("selectPrivateChannel"));
const getSelectedChannelStore = lazy(() => rawFindByName<any>("SelectedChannelStore"));
const getNavContext = lazy(() => rawFindByFunctionProps<any>("getGuildId"));

function openDms() {
    const Haptic = getHaptic();
    Haptic?.triggerHapticFeedback?.(Haptic.HapticFeedbackTypes.SOFT);
    const ChannelActions = getChannelActions();
    if (ChannelActions?.selectPrivateChannel) {
        const lastChannelId = getSelectedChannelStore()?.getLastSelectedChannelId?.();
        ChannelActions.selectPrivateChannel(lastChannelId);
    }
}

// Was previously a full replacement for the native left server rail (rendered instead of it) -
// moved into the drawer's own grid instead, as the first tile, so DMs live in the same place as
// every other server rather than in a leftover spot from the sidebar this plugin otherwise hides.
export default function DmTile() {
    const Flux = getFlux();
    const NavContext = getNavContext();
    const colors = getColorModule()?.colors;

    const selected = Flux?.useStateFromStores?.(
        [NavContext],
        () => NavContext?.getGuildId?.() == null,
    ) ?? false;

    return (
        <Pressable onPress={openDms} style={st.outer}>
            <View style={[st.icon, { backgroundColor: selected ? (colors?.BG_ACCENT ?? "#5865f2") : "rgba(128,128,128,0.24)" }]}>
                <Image source={ChatIcon} style={{ width: 24, height: 24, tintColor: "#fff" }} />
            </View>
        </Pressable>
    );
}

const st = StyleSheet.create({
    outer: { width: ICON, height: ICON },
    icon: { width: ICON, height: ICON, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
