import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import getTag from "../lib/getTag";
import GradientTag from "../ui/GradientTag";

// Covers the name row shown in chat messages (next to the display name + timestamp) and channel headers.
// findByName("DisplayName", false) stopped matching - confirmed live (Key Inspector's Eval console,
// a full module-key scan) that the module still exports a property literally named DisplayName, but
// findByName matches by the component's own runtime .name/.displayName, which doesn't survive
// production minification the way the export's property key does. findByProps looks at property
// keys instead, so the patch target changes from DisplayName.default to DisplayNameModule.DisplayName.
// HeaderName's current name isn't confirmed yet - still guarded, just not fixed.
const DisplayNameModule = findByProps("DisplayName") as any;
const HeaderName = findByName("HeaderName", false);
const TagModule = findByProps("getBotLabel");

const GuildStore = findByStoreName("GuildStore");
const ChannelStore = findByStoreName("ChannelStore");

export default () => {
    const patches: (() => void)[] = [];

    if (HeaderName) {
        patches.push(after("default", HeaderName, ([{ channelId }], ret) => {
            if (ret?.props) ret.props.channelId = channelId;
        }));
    }

    if (DisplayNameModule?.DisplayName) {
        patches.push(after("DisplayName", DisplayNameModule, ([{ guildId, channelId, user }], ret) => {
            try {
                const tagComponent = findInReactTree(ret, (c) => c?.type?.Types);

                // A real built-in tag (bot/system/etc.) is already present - don't touch it.
                if (tagComponent && tagComponent.props?.type !== 0) return;

                const guild = GuildStore?.getGuild(guildId);
                const channel = ChannelStore?.getChannel(channelId);
                const tag = getTag(guild, channel, user);
                if (!tag) return;

                if (tagComponent) {
                    tagComponent.props = {
                        type: 0,
                        text: tag.text,
                        textColor: tag.textColor,
                        backgroundColor: tag.backgroundColor,
                        verified: tag.verified
                    };
                    return;
                }

                const row = findInReactTree(ret, (c) => c?.props?.style?.flexDirection === "row");
                if (!Array.isArray(row?.props?.children)) return;

                if (tag.gradientColor) {
                    row.props.children.push(
                        <GradientTag
                            style={{ marginLeft: 0 }}
                            text={tag.text}
                            textColor={tag.textColor}
                            backgroundColor={tag.backgroundColor}
                            gradientColor={tag.gradientColor}
                        />
                    );
                } else if (TagModule) {
                    row.props.children.push(
                        <TagModule.default
                            style={{ marginLeft: 0 }}
                            type={0}
                            text={tag.text}
                            textColor={tag.textColor}
                            backgroundColor={tag.backgroundColor}
                            verified={tag.verified}
                        />
                    );
                }
            } catch {
                // Never let one bad lookup take down every name row on screen.
            }
        }));
    }

    return () => patches.forEach((unpatch) => unpatch());
};
