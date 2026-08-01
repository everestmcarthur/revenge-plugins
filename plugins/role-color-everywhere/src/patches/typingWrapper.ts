import { findByProps, findByStoreName } from "@vendetta/metro";
import { React, constants } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { General } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { defaultTextColor } from "../lib/color";

const { Text } = General;
const UserStore = findByStoreName("UserStore");
const RelationshipStore = findByStoreName("RelationshipStore");
const GuildMemberStore = findByStoreName("GuildMemberStore");
const TypingWrapper = findByProps("TYPING_WRAPPER_HEIGHT");

export default function patchTypingWrapper(): () => void {
    if (!TypingWrapper?.default) return () => {};

    return after("default", TypingWrapper, ([{ channel }]: any[], res: any) => {
        try {
            if (!res || storage.hideTyping) return;

            const Typing = res.props?.children;
            if (!Typing) return;

            const unpatchTyping = after("type", Typing, (_: any, typingRes: any) => {
                try {
                    React.useEffect(() => () => unpatchTyping(), []);

                    const typingThing = typingRes?.props?.children?.[0]?.props?.children?.[1]?.props;
                    if (!typingThing?.children || typingThing.children === "Several people are typing...") return;

                    const users = (TypingWrapper.useTypingUserIds?.(channel.id) ?? []).map((userId: string) => {
                        const member = GuildMemberStore?.getMember(channel.guild_id, userId);
                        const user = UserStore?.getUser(userId);
                        const name = member?.nick || RelationshipStore?.getNickname?.(userId) || user?.globalName || user?.username || "Someone";
                        const color = member?.colorString || defaultTextColor();
                        return { name, color };
                    });

                    if (!users.length) return;

                    const userText = (u: { name: string; color: any }) =>
                        React.createElement(Text, { style: { color: u.color, fontFamily: constants.Fonts.DISPLAY_SEMIBOLD } }, u.name);

                    typingThing.children =
                        users.length === 1
                            ? [userText(users[0]), " is typing..."]
                            : [
                                  ...users.slice(0, -1).flatMap((u: any, i: number) => [userText(u), i < users.length - 2 ? ", " : " and "]),
                                  userText(users[users.length - 1]),
                                  " are typing..."
                              ];
                } catch {
                    // Leave the default "X is typing..." text alone.
                }
            });
        } catch {
            // Skip typing indicator coloring entirely for this render.
        }
    });
}
