import { findByProps, findByStoreName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { storage } from "@vendetta/plugin";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import { defaultTextColor } from "../lib/color";

const GuildMemberStore = findByStoreName("GuildMemberStore");

// Colors usernames in the "X is typing..." indicator. TYPING_WRAPPER_HEIGHT (what this used to
// look up) doesn't exist anymore - the actual component is TypingIndicatorInner, which isn't a
// top-level export, and it hands us channel + typingUserIds directly as props. Each typing user
// gets their own inner <Text> element in the same order as typingUserIds, so we just zip them up.
export default function patchTypingWrapper(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "role-color-everywhere-typing-indicator",
        (type) => typeof type === "function" ? type.name === "TypingIndicatorInner" : type?.type?.name === "TypingIndicatorInner",
        (TypingIndicatorInner: any) => {
            const inner = typeof TypingIndicatorInner === "function" ? TypingIndicatorInner : TypingIndicatorInner.type;

            const PatchedTypingIndicatorInner = (props: any) => {
                const ret = inner(props);

                try {
                    if (storage.hideTyping) return ret;

                    const label = findInReactTree(
                        ret,
                        (n: any) =>
                            Array.isArray(n?.props?.children) &&
                            n.props.children.some((c: any) => typeof c === "string" && c.includes("typing..."))
                    );
                    if (!Array.isArray(label?.props?.children)) return ret;

                    // "Several people are typing..." collapses to one plain string with no
                    // per-user elements to color - nothing to do here, leave it as-is.
                    const userElements = label.props.children.filter((c: any) => c && typeof c === "object");
                    const typingUserIds: string[] = props?.typingUserIds ?? [];
                    if (!userElements.length || userElements.length !== typingUserIds.length) return ret;

                    const channel = props?.channel;
                    userElements.forEach((el: any, i: number) => {
                        const userId = typingUserIds[i];
                        const member = userId && channel ? GuildMemberStore?.getMember(channel.guild_id, userId) : null;
                        const color = member?.colorString || defaultTextColor();
                        if (!color || !el?.props) return;
                        el.props.style = Array.isArray(el.props.style)
                            ? [...el.props.style, { color }]
                            : el.props.style
                              ? [el.props.style, { color }]
                              : { color };
                    });
                } catch {
                    // Leave the default "X is typing..." text alone.
                }

                return ret;
            };

            registerIntercept(TypingIndicatorInner, PatchedTypingIndicatorInner);
        }
    );

    return () => cleanups.forEach((fn) => fn());
}
