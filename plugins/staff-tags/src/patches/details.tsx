import { findByProps, findByStoreName, findByTypeNameAll } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import getTag from "../lib/getTag";
import GradientTag from "../ui/GradientTag";

// Covers member list rows and the profile popout, where the name and tag sit on the same line.
const TagModule = findByProps("getBotLabel");
const GuildStore = findByStoreName("GuildStore");

const rowPatch = ([{ guildId, user }]: any[], res: any) => {
    try {
        const label = res?.props?.label;
        const nameContainer = findInReactTree(
            label,
            (c) =>
                Array.isArray(c?.props?.children) &&
                c.props.children.some(
                    (ch: any) => typeof ch === "string" || typeof ch?.props?.children === "string"
                )
        );
        if (!nameContainer) return;

        if (findInReactTree(nameContainer, (c) => c?.props?.__revengeCustomTag)) return;

        const existingTag = findInReactTree(nameContainer, (c) => c?.type?.Types);
        if (existingTag && existingTag.props?.type !== 0) return;

        const guild = GuildStore?.getGuild(guildId);
        const tag = getTag(guild, undefined, user);
        if (!tag) return;

        if (existingTag) {
            Object.assign(existingTag.props, {
                type: 0,
                text: tag.text,
                textColor: tag.textColor,
                backgroundColor: tag.backgroundColor,
                icon: tag.icon,
                iconColor: tag.iconColor,
                verified: tag.verified,
                __revengeCustomTag: true
            });
            return;
        }

        if (!Array.isArray(nameContainer.props.children)) {
            nameContainer.props.children = [nameContainer.props.children];
        }

        if (tag.gradientColor) {
            nameContainer.props.children.push(
                <GradientTag
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    gradientColor={tag.gradientColor}
                    icon={tag.icon}
                    iconColor={tag.iconColor}
                    __revengeCustomTag={true}
                />
            );
        } else if (TagModule) {
            nameContainer.props.children.push(
                <TagModule.default
                    type={0}
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    icon={tag.icon}
                    iconColor={tag.iconColor}
                    verified={tag.verified}
                    __revengeCustomTag={true}
                />
            );
        }
    } catch {
        // Never let one bad lookup take down the whole member list.
    }
};

export default () => {
    const patches: (() => void)[] = [];
    const rows = findByTypeNameAll("UserRow") ?? [];

    rows.forEach((UserRow: any) => patches.push(after("type", UserRow, rowPatch)));

    return () => patches.forEach((unpatch) => unpatch());
};
