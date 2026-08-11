import React from "react";
import { View, Text, Pressable, Animated, Dimensions, StyleSheet, BackHandler } from "react-native";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { lazy } from "../lib/lazy";
import { rawFind, rawFindByFunctionProps } from "../lib/rawFind";
import { getFlux, getHaptic, getColorModule } from "../lib/commonModules";
import { GuildNode } from "../utils/theme";
import GuildItem from "./GuildItem";
import FolderItem from "./FolderItem";
import DmTile from "./DmTile";

const getRootNav = lazy(() => rawFindByFunctionProps("getRootNavigationRef"));
const getRouting = lazy(() => rawFindByFunctionProps("transitionToGuild"));
const getCreateJoinGuildMod = lazy(() => rawFind((m: any) => typeof m?.handleCreateJoinGuildPress === "function"));
const getCirclePlusIcon = lazy(() => rawFind((m: any) => m?.CirclePlusIcon)?.CirclePlusIcon);

const getExternalContext = lazy(() => rawFind((m: any) => m?.QuestDockExternalCoordinationContext)?.QuestDockExternalCoordinationContext);
const getQuestDockMode = lazy(() => rawFind((m: any) => m?.QuestDockMode?.COLLAPSED != null)?.QuestDockMode);
const getSortedGuildStore = lazy(() => rawFind((m: any) => typeof m?.getName === "function" && m.getName.length === 0 && m.getName() === "SortedGuildStore"));

const ICON = 48;
const GAP = 6;
const PAD = 12;

// Confirmed live: an account with folders showed no drawer at all - not even the DM tile, other
// servers, or the create/join button, which have nothing to do with folders. That points at an
// uncaught throw somewhere in FolderItem's render taking the whole grid down with it, not just the
// one folder. A try/catch around JSX can't catch this - the exception happens during React's own
// render pass, not synchronously in this function's body - only a class component's
// getDerivedStateFromError can. Wrapping each folder individually means one broken folder
// disappears instead of every other server in the drawer.
class FolderErrorBoundary extends React.Component<{ children: React.ReactNode }, { errored: boolean }> {
    state = { errored: false };
    static getDerivedStateFromError() {
        return { errored: true };
    }
    render() {
        if (this.state.errored) return null;
        return this.props.children;
    }
}

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
    const rawColors = getColorModule()?.unsafe_rawColors;

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
    useProxy(storage);

    const pick = React.useCallback((id: string) => {
        const haptic = getHaptic();
        haptic?.triggerHapticFeedback?.(haptic.HapticFeedbackTypes.SOFT);

        const routing = getRouting();
        if (routing?.transitionToGuild) {
            routing.transitionToGuild(id);
        } else {
            getRootNav()?.getRootNavigationRef?.()?.navigate("guilds", { guildId: id });
        }
    }, []);

    const Flux = getFlux();
    const SortedGuildStore = getSortedGuildStore();

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

    const ExternalContext = getExternalContext();
    const extCtx = ExternalContext ? React.useContext(ExternalContext) as any : null;
    const setMode = extCtx?.setRestingQuestDockMode;

    const specs = ctx?.questDockWrapperSpecs;

    React.useEffect(() => {
        const QuestDockMode = getQuestDockMode();
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
                {!storage.hideDmTile && <DmTile />}
                {nodes.map((node) =>
                    node.type === "folder"
                        ? (
                            <FolderErrorBoundary key={node.id}>
                                <FolderItem node={node} onPick={pick} />
                            </FolderErrorBoundary>
                        )
                        : <GuildItem key={node.id} node={node} onPick={pick} />
                )}
                <CreateJoinButton />
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
