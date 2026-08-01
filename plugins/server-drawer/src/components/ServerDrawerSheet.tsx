import React from "react";
import { View, Text, Pressable, Animated, Dimensions, StyleSheet, BackHandler } from "react-native";
import { find, findByProps, findByStoreName } from "@vendetta/metro";
import { lazy } from "@shared/lib/lazy";
import { GuildNode } from "../utils/theme";
import GuildItem from "./GuildItem";
import FolderItem from "./FolderItem";
import DmTile from "./DmTile";
import MarkAllReadButton from "./MarkAllReadButton";

const Flux = findByProps("useStateFromStores");
const SortedGuildStore = findByStoreName("SortedGuildStore");

// These are looked up lazily (retried on first real use, not cached the moment this file is
// required) because this whole module gets evaluated as soon as the plugin's bundle loads - which
// can be before Discord's own routing/navigation modules have been required yet. A one-shot
// findByProps() here would then permanently cache undefined even though the real module shows up
// moments later, which is exactly what made tapping a server in the drawer silently do nothing.
const getRootNav = lazy(() => findByProps("getRootNavigationRef"));
const getHaptic = lazy(() => findByProps("triggerHapticFeedback", "HapticFeedbackTypes"));
const getRouting = lazy(() => findByProps("transitionToGuild"));
const getCreateJoinGuildMod = lazy(() => find((m: any) => typeof m?.handleCreateJoinGuildPress === "function"));
const getCirclePlusIcon = lazy(() => find((m: any) => m?.CirclePlusIcon)?.CirclePlusIcon);
const getRawColors = lazy(() => findByProps("colors", "unsafe_rawColors")?.unsafe_rawColors);

const ExternalCoordinationMod = find((m: any) => m?.QuestDockExternalCoordinationContext);
const ExternalContext = ExternalCoordinationMod?.QuestDockExternalCoordinationContext;
const QuestDockMode = find((m: any) => m?.QuestDockMode?.COLLAPSED != null)?.QuestDockMode;

const ICON = 48;
const GAP = 6;
const PAD = 12;

function CreateJoinButton() {
    const scale = React.useRef(new Animated.Value(1)).current;
    const scaleDown = React.useCallback(() => {
        Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }).start();
    }, [scale]);
    const scaleUp = React.useCallback(() => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    }, [scale]);

    const onPress = React.useCallback(() => {
        const haptic = getHaptic();
        haptic?.triggerHapticFeedback?.(haptic.HapticFeedbackTypes.SOFT);
        getCreateJoinGuildMod()?.handleCreateJoinGuildPress?.();
    }, []);

    const CirclePlusIcon = getCirclePlusIcon();
    const rawColors = getRawColors();

    return (
        <Pressable onPress={onPress} onPressIn={scaleDown} onPressOut={scaleUp}>
            <Animated.View style={[st.createJoin, { backgroundColor: rawColors?.GREEN_360, transform: [{ scale }] }]}>
                {CirclePlusIcon ? (
                    <CirclePlusIcon size="md" color={rawColors?.WHITE} />
                ) : (
                    <Text style={[st.createJoinFallback, { color: rawColors?.WHITE }]}>{"+"}</Text>
                )}
            </Animated.View>
        </Pressable>
    );
}

export default function ServerDrawerSheet({ gestureContext }: { gestureContext: any }) {
    const pick = React.useCallback((id: string) => {
        const haptic = getHaptic();
        haptic?.triggerHapticFeedback?.(haptic.HapticFeedbackTypes.SOFT);

        const routing = getRouting();
        if (routing?.transitionToGuild) {
            // Confirmed against decompiled current-build Discord source
            // (modules/routing/transitionToGuild.native.tsx): the mobile transitionToGuild takes
            // (guildId, options?) and resolves the channel itself - it does NOT take a channelId
            // as a second positional argument. Passing one (as this used to) risked being silently
            // wrong depending on which of the two same-named "transitionToGuild" modules metro
            // happened to resolve.
            routing.transitionToGuild(id);
        } else {
            getRootNav()?.getRootNavigationRef?.()?.navigate("guilds", { guildId: id });
        }
    }, []);

    const nodes: GuildNode[] = Flux?.useStateFromStores?.(
        [SortedGuildStore],
        () => {
            const t = SortedGuildStore?.getGuildsTree();
            return (t?.root?.children || []).filter((n: GuildNode) => n.type !== "root");
        },
    ) ?? [];

    const ctx = (gestureContext ? React.useContext(gestureContext) : null) as any;
    const minH = ctx?.minExpandedContentHeight;

    const onLayout = React.useCallback((e: any) => {
        if (!minH) return;
        const h = e.nativeEvent.layout.height;
        if (minH.get() !== h) minH.set(h);
    }, [minH]);

    const extCtx = ExternalContext ? React.useContext(ExternalContext) as any : null;
    const setMode = extCtx?.setRestingQuestDockMode;

    const specs = ctx?.questDockWrapperSpecs;

    React.useEffect(() => {
        if (!setMode || !QuestDockMode || !specs) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            const h = specs.get()?.height ?? 56;
            if (h > 80) {
                setMode(QuestDockMode.COLLAPSED);
                return true;
            }
            return false;
        });
        return () => sub.remove();
    }, [setMode, specs]);

    const { width: winW } = Dimensions.get("window");

    const cols = Math.max(3, Math.floor((winW - PAD * 2 + GAP) / (ICON + GAP)));
    const totalW = cols * ICON + (cols - 1) * GAP;
    const padX = Math.max(0, (winW - totalW) / 2);

    return (
        <View style={st.alignTop}>
            <View
                style={[st.grid, { paddingHorizontal: padX, gap: GAP }]}
                onLayout={onLayout}
            >
                <DmTile />
                {nodes.map((node) =>
                    node.type === "folder"
                        ? <FolderItem key={node.id} node={node} onPick={pick} />
                        : <GuildItem key={node.id} node={node} onPick={pick} />
                )}
                <CreateJoinButton />
                <MarkAllReadButton />
            </View>
        </View>
    );
}

const st = StyleSheet.create({
    alignTop: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-start",
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingTop: 4,
        paddingBottom: 16,
    },
    createJoin: {
        width: ICON,
        height: ICON,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
    },
    createJoinFallback: {
        fontSize: 28,
        fontWeight: "700",
        lineHeight: 30,
    },
});
