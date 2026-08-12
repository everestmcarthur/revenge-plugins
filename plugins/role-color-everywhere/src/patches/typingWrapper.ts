import { findByProps, findByStoreName } from "@vendetta/metro";
import { findInReactTree } from "@vendetta/utils";
import { storage } from "@vendetta/plugin";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import { defaultTextColor } from "../lib/color";

const GuildMemberStore = findByStoreName("GuildMemberStore");

// Colors usernames in the "X is typing..." indicator. The component is TypingIndicatorInner, not
// a top-level export, hands us channel + typingUserIds as props - zipped against each user's own
// inner <Text> element in the same order.
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
