import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import React from "react";

import { findParentInTree, getComponentNameFromType, isElement, type RN } from "@fpte/lib/reactNativeRenderTree";
import { Builder } from "@fpte/ui/components";

const funcParent = findByName("GuildProfileEditForm", false);

export const patchGuildProfileEditForm = () => after("default", funcParent, (_args: unknown[], tree: RN.Node) => {
    if (storage.hideBuilder) return tree;

    console.log("[GuildProfileEditForm] Render tree:", tree);
    console.log("[GuildProfileEditForm] Direct children:", tree?.props?.children);

    let guildId: string | undefined;
    const parent = findParentInTree(tree, (children): children is RN.Node[] =>
        Array.isArray(children) && children.some(child => {
            if (isElement(child)) {
                const name = getComponentNameFromType(child.type);
                console.log("[GuildProfileEditForm] Child component:", name, child.props);
                if (name === "EditGuildIdentityBio") {
                    guildId = (child.props as any).displayProfile?.guildId;
                    return true;
                }
            }
            return false;
        })
    );

    if (parent) {
        console.log("[GuildProfileEditForm] Found parent:", parent);
        parent.props.children.splice(2, 0, <Builder guildId={guildId} />);
    } else {
        console.warn("[GuildProfileEditForm] Parent not found.");
    }

    return tree;
});