import { findByName, findByStoreName } from "@vendetta/metro";
import { ReactNative, chroma } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import getTag from "../lib/getTag";

const getTagProperties = findByName("getTagProperties", false);
const GuildStore = findByStoreName("GuildStore");
const ChannelStore = findByStoreName("ChannelStore");

// Chat message tags are rendered from plain data (not a patchable element tree), so gradients
// aren't possible here - only in the member list and profile, where we control the JSX directly.
export default () => {
    if (!getTagProperties) return () => {};

    return after("default", getTagProperties, ([{ message }], ret) => {
        if (ret?.tagType || ret?.__revengeCustomTag) return;

        const channel = ChannelStore?.getChannel(message?.channel_id);
        const guild = GuildStore?.getGuild(channel?.guild_id);
        const tag = getTag(guild, channel, message?.author);
        if (!tag) return;

        const tagText = tag.icon
            ? tag.text
                ? `${tag.icon.fallback} ${tag.text}`
                : tag.icon.fallback
            : tag.text;

        return {
            ...ret,
            tagText,
            tagTextColor: tag.textColor ? ReactNative.processColor(chroma(tag.textColor).hex()) : undefined,
            tagBackgroundColor: ReactNative.processColor(chroma(tag.backgroundColor).hex()),
            tagVerified: tag.verified,
            tagType: undefined,
            __revengeCustomTag: true
        };
    });
};
