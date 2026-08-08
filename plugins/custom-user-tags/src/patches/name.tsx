import { findByProps } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { findInReactTree } from "@vendetta/utils";
import resolveTag from "../lib/resolveTag";

const TagModule = findByProps("getBotLabel");

// findByName("DisplayName", false) doesn't match - confirmed live via Key Inspector's Eval console
// (a full module-key scan, while fixing Staff Tags' identical lookup) that the export survives as a
// plain named property, not the component's own runtime .name/.displayName, which doesn't survive
// production minification. findByProps looks at property keys instead.
const DisplayNameModule = findByProps("DisplayName") as any;

export default () => {
    if (!DisplayNameModule?.DisplayName) return () => {};

    return after("DisplayName", DisplayNameModule, ([{ user }]: any[], ret: any) => {
        try {
            const tagComponent = findInReactTree(ret, (c) => c?.type?.Types);
            if (tagComponent && tagComponent.props?.type !== 0) return;

            const tag = resolveTag(user?.id);
            if (!tag) return;

            if (tagComponent) {
                tagComponent.props = {
                    type: 0,
                    text: tag.text,
                    textColor: tag.textColor,
                    backgroundColor: tag.backgroundColor,
                    icon: tag.icon,
                    iconColor: tag.iconColor,
                    verified: false
                };
                return;
            }

            const row = findInReactTree(ret, (c) => c?.props?.style?.flexDirection === "row");
            if (!Array.isArray(row?.props?.children) || !TagModule) return;

            row.props.children.push(
                <TagModule.default
                    style={{ marginLeft: 0 }}
                    type={0}
                    text={tag.text}
                    textColor={tag.textColor}
                    backgroundColor={tag.backgroundColor}
                    icon={tag.icon}
                    iconColor={tag.iconColor}
                    verified={false}
                />
            );
        } catch {
            // Never let one bad lookup take down every name row on screen.
        }
    });
};
