import { React } from "@vendetta/metro/common";
import { findInReactTree } from "@vendetta/utils";
import { registerTypeDetector, registerIntercept, patchCreateElement } from "@shared/lib/createElementIntercept";
import AvatarStack from "../components/AvatarStack";

// Mirrors role-color-everywhere's typingWrapper.ts for detection/wrapping, but replaces the
// label's content with AvatarStack instead of recoloring the existing text nodes.
export default function patchTypingIndicator(): () => void {
    const cleanups: (() => void)[] = [];
    patchCreateElement(cleanups);

    registerTypeDetector(
        "typing-avatars-indicator",
        (type) => typeof type === "function" ? type.name === "TypingIndicatorInner" : type?.type?.name === "TypingIndicatorInner",
        (TypingIndicatorInner: any) => {
            const inner = typeof TypingIndicatorInner === "function" ? TypingIndicatorInner : TypingIndicatorInner.type;

            const PatchedTypingIndicatorInner = (props: any) => {
                const ret = inner(props);

                try {
                    const label = findInReactTree(
                        ret,
                        (n: any) =>
                            Array.isArray(n?.props?.children) &&
                            n.props.children.some((c: any) => typeof c === "string" && c.includes("typing..."))
                    );
                    if (!label?.props) return ret;

                    const typingUserIds: string[] = props?.typingUserIds ?? [];
                    if (!typingUserIds.length) return ret;

                    label.props.children = (
                        <AvatarStack typingUserIds={typingUserIds} guildId={props?.channel?.guild_id} />
                    );
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
