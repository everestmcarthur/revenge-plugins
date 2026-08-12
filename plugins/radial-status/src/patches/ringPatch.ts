import { General } from "@vendetta/ui/components";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

// Forked from AngelW0lf's Radial Status (BSD-3-Clause, see LICENSE). Real presence-carrying
// wrappers are square, borderRadius === width/2, with a user.id + status on children[1]/[3], and
// exactly 5 children - matched against this confirmed set of sizes rather than any circular shape.
const CONFIRMED_SIZES = new Set([24, 32, 40, 50, 60, 80]);

export default function patchRing(): () => void {
    if (!General?.View) return () => {};

    return before("render", General.View, (args: any[]) => {
        try {
            const [wrapper] = args;
            if (!wrapper || !Array.isArray(wrapper.style)) return;
            if (!Array.isArray(wrapper.children) || wrapper.children.length !== 5) return;

            const circleIdx = wrapper.style.findIndex(
                (s: any) =>
                    s &&
                    typeof s.width === "number" &&
                    s.width === s.height &&
                    s.borderRadius === s.width / 2 &&
                    CONFIRMED_SIZES.has(s.width)
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
            // Additive growth (fixed px), not a percentage multiplier - a flat multiplier made the
            // ring way too thick on large avatars (YouBar) relative to small ones (member list).
            const thickness = storage.ringThickness ?? 2;
            const newSize = baseSize + thickness * 2;

            presenceProps.size = 0;
            presenceProps.isMobileOnline = false;
            if (presenceProps.style) presenceProps.style.display = "none";
            if (userProps.cutout?.nativeCutouts?.[0]) userProps.cutout.nativeCutouts[0].size = 0;

            wrapper.style[circleIdx] = {
                width: newSize,
                height: newSize,
                borderRadius: newSize / 2,
                overflow: "hidden"
            };
            wrapper.style.push({
                borderWidth: thickness,
                borderColor: color,
                borderStyle: "solid"
            });
        } catch {
            // Leave the native presence dot alone.
        }
    });
}
