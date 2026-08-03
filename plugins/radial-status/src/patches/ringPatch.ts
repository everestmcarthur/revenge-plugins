import { General } from "@vendetta/ui/components";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

/**
 * Forked from AngelW0lf's Radial Status (BSD-3-Clause, see LICENSE). This repo's own first attempt
 * "generalized" upstream's exact wrapper-size check (32x32, borderRadius 16 only) to any square,
 * fully-circular wrapper, on the theory that avatar sizes differ across contexts - that broadened
 * match visibly corrupted member list rows and the profile status indicator on-device, and still
 * never matched YouBar's own indicator at all.
 *
 * Confirmed live via Key Inspector's Eval console (a capture across YouBar, the profile screen,
 * member lists, and DM lists) exactly which sizes are real presence-carrying wrappers: 24, 32, 40,
 * 50, 60, and 80 (all square, all borderRadius === width/2, all with a `user.id` string + a
 * `status` string on children[1]/[3], and every single one with exactly 5 children) - so this now
 * matches that confirmed set specifically, plus the same child-count check every real one shared,
 * rather than either the overly narrow single-size check or the overly broad any-circle one.
 */
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
            // Growth is additive (a fixed number of px on each side), not a percentage multiplier -
            // a flat multiplier applied the same 30% growth everywhere, which meant a much bigger
            // ABSOLUTE size increase on large avatars (e.g. +24px at YouBar's 80px size) than on small
            // ones (+9.6px at a 32px member-list row) even though the relative growth was identical.
            // That's confirmed on-device as "slightly too big" on member list/profile and "way too big"
            // on YouBar - additive growth keeps the ring the same absolute thickness everywhere instead.
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
