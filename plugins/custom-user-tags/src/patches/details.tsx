import { findByProps, findByTypeNameAll } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import resolveTag from "../lib/resolveTag";
import openTagEditor from "../ui/TagEditorAlert";

const TagModule = findByProps("getBotLabel");

// Covers member list rows and the profile popout, plus the long-press hook for assigning a tag
// (no confirmed way to hook Discord's own user context menu).
const rowPatch = ([{ user }]: any[], res: any) => {
    try {
        if (user?.id && res?.props) {
            const existingLongPress = res.props.onLongPress;
            res.props.onLongPress = (...args: any[]) => {
                existingLongPress?.(...args);
                openTagEditor(user.id, user.globalName || user.username || user.id);
            };
        }

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

        const existingTag = findInReactTree(nameContainer, (c) => c?.type?.Types);
        if (existingTag && existingTag.props?.type !== 0) return;

        const tag = resolveTag(user?.id);
        if (!tag) return;

        if (existingTag) {
            Object.assign(existingTag.props, {
                type: 0,
                text: tag.text,
                textColor: tag.textColor,
                backgroundColor: tag.backgroundColor,
                icon: tag.icon,
                iconColor: tag.iconColor,
                verified: false
            });
            return;
        }

        if (!Array.isArray(nameContainer.props.children)) {
            nameContainer.props.children = [nameContainer.props.children];
        }

        if (TagModule) {
            nameContainer.props.children.push(
                <TagModule.default
                    type={0}
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    icon={tag.icon}
                    iconColor={tag.iconColor}
                    verified={false}
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
