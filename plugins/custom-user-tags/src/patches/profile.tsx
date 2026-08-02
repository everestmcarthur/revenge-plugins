import { find, findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import resolveTag from "../lib/resolveTag";

// Same top-level profile component PronounDB already confirmed works, and the same one Staff Tags
// now patches for its own profile-screen tag - see that plugin's patches/profile.tsx for the full
// writeup on why this is a separate component from UserRow (which details.tsx already handles).
const UserProfile =
    find((m: any) => m?.type?.name === "UserProfileContent") ??
    find((m: any) => m?.type?.name === "UserProfile");

const TagModule = findByProps("getBotLabel");

/**
 * Not independently confirmed against a live render yet - the exact prop shape passed to this
 * component isn't verified on-device, so this pulls from whichever of several plausible field names
 * is actually present. Every step is guarded, so a wrong assumption just means no tag appears here.
 */
export default function patchProfile(): () => void {
    if (!UserProfile) return () => {};

    return after("type", UserProfile, (args: any[], res: any) => {
        try {
            const props = args?.[0] ?? {};
            const userId: string | undefined = props.userId ?? props.user?.id ?? props.displayProfile?.userId;
            if (!userId) return;

            const tag = resolveTag(userId);
            if (!tag) return;

            const primaryInfo = findInReactTree(res, (c) => c?.type?.name === "PrimaryInfo" || c?.type?.displayName === "PrimaryInfo");
            if (!primaryInfo) return;

            const existingTag = findInReactTree(primaryInfo, (c) => c?.type?.Types);
            if (existingTag && existingTag.props?.type !== 0) return;

            if (existingTag) {
                Object.assign(existingTag.props, {
                    type: 0,
                    text: tag.text,
                    textColor: tag.textColor,
                    backgroundColor: tag.backgroundColor,
                    verified: false
                });
                return;
            }

            const nameRow = findInReactTree(
                primaryInfo,
                (c) =>
                    Array.isArray(c?.props?.children) &&
                    c.props.children.some((ch: any) => typeof ch === "string" || typeof ch?.props?.children === "string")
            );
            if (!Array.isArray(nameRow?.props?.children) || !TagModule) return;

            nameRow.props.children.push(
                <TagModule.default
                    type={0}
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    verified={false}
                />
            );
        } catch {
            // Skip - a broken profile tag beats a crashed profile screen.
        }
    });
}
