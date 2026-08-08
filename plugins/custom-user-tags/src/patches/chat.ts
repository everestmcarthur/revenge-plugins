import { findByName } from "@vendetta/metro";
import { ReactNative, chroma } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import resolveTag from "../lib/resolveTag";

const getTagProperties = findByName("getTagProperties", false);

// Chat message tags are rendered from plain data (not a patchable element tree), so this can only
// ever produce a solid-color tag here - same platform limitation Staff Tags documents for the same
// reason.
export default () => {
    if (!getTagProperties) return () => {};

    return after("default", getTagProperties, ([{ message }], ret) => {
        if (ret?.tagType) return;

        const tag = resolveTag(message?.author?.id);
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
            tagVerified: false,
            tagType: undefined
        };
    });
};
