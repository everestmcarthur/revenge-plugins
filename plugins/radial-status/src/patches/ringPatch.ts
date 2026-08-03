import { General } from "@vendetta/ui/components";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

/**
 * Forked from AngelW0lf's Radial Status (BSD-3-Clause, see LICENSE). This repo's own first attempt
 * "generalized" upstream's exact wrapper-size check (32x32, borderRadius 16) to any square,
 * fully-circular wrapper, on the theory that avatar sizes differ across contexts - that broadened
 * match turned out to false-positive on unrelated Views (confirmed on-device: it visibly corrupted
 * member list rows and the profile status indicator, and never matched YouBar's own indicator at
 * all). The user was separately running upstream's own unmodified build live on Revenge with none
 * of those problems, which means the narrow exact-size check was never the issue - reverted to it
 * here instead of the broadened guess.
 */
export default function patchRing(): () => void {
    if (!General?.View) return () => {};

    return before("render", General.View, (args: any[]) => {
        try {
            const [wrapper] = args;
            if (!wrapper || !Array.isArray(wrapper.style)) return;

            const circleIdx = wrapper.style.findIndex(
                (s: any) => s && s.width === 32 && s.height === 32 && s.borderRadius === 16
            );
            if (circleIdx === -1) return;

            const userProps = wrapper.children?.[1]?.props;
            const presenceProps = wrapper.children?.[3]?.props;
            if (!userProps || typeof userProps.user?.id !== "string") return;
            if (!presenceProps || typeof presenceProps.status !== "string") return;

            const colors = storage.colors ?? {};
            const color = colors[presenceProps.status as string];
            if (!color) return; // no color configured for this status - leave the native dot alone

            const baseSize = wrapper.style[circleIdx].width;
            const mult = storage.ringMult ?? 1.3;
            const thickness = storage.ringThickness ?? 2.5;

            presenceProps.size = 0;
            presenceProps.isMobileOnline = false;
            if (presenceProps.style) presenceProps.style.display = "none";
            if (userProps.cutout?.nativeCutouts?.[0]) userProps.cutout.nativeCutouts[0].size = 0;

            wrapper.style[circleIdx] = {
                width: baseSize * mult,
                height: baseSize * mult,
                borderRadius: (baseSize / 2) * mult,
                overflow: "hidden"
            };
            wrapper.style.push({
                borderWidth: thickness * mult,
                borderColor: color,
                borderStyle: "solid"
            });
        } catch {
            // Leave the native presence dot alone.
        }
    });
}
