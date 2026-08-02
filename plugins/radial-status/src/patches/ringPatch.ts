import { General } from "@vendetta/ui/components";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

/**
 * Forked from AngelW0lf's Radial Status (BSD-3-Clause, see LICENSE). The upstream original matched
 * one hardcoded wrapper size (exactly 32x32, borderRadius 16) - generalized here to any square,
 * fully-circular wrapper (borderRadius === width / 2) instead, since avatar sizes differ across
 * member lists, DM lists, and profile popouts, and the two structural checks right below (a `user`
 * prop with a string id, a `status` prop) already confirm this is the right element regardless of
 * its exact pixel size.
 *
 * Not independently re-verified against a live decompiled build the way the rest of this repo's
 * fixes are - this is a straight-line adaptation of upstream's own (previously working, per its
 * changelog) logic. Every assumption below is guarded, so a shape mismatch just means the ring
 * doesn't draw for that avatar, not a crash.
 */
export default function patchRing(): () => void {
    if (!General?.View) return () => {};

    return before("render", General.View, (args: any[]) => {
        try {
            const [wrapper] = args;
            if (!wrapper || !Array.isArray(wrapper.style)) return;

            const circleIdx = wrapper.style.findIndex(
                (s: any) => s && typeof s.width === "number" && s.width === s.height && s.borderRadius === s.width / 2
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
