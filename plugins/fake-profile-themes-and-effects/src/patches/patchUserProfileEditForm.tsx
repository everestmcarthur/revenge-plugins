import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import React from "react";

import { findParentInTree, getComponentNameFromType, isElement, type RN } from "@fpte/lib/reactNativeRenderTree";
import { Builder } from "@fpte/ui/components";

const funcParent = findByName("UserProfileEditForm", false);

export const patchUserProfileEditForm = () => {
  if (!funcParent) return () => {};

  return after("default", funcParent, (_args: unknown[], tree: RN.Node) => {
    try {
      if (storage.hideBuilder) return tree;

      const parent = findParentInTree(tree, (children): children is RN.Node[] =>
        Array.isArray(children) &&
        children.some(child =>
          isElement(child) &&
          getComponentNameFromType(child.type) === "UserProfileEditFormTextField"
        )
      );

      if (parent) {
        const index = parent.props.children.reduce<number[]>((acc, child, i) => {
          if (
            isElement(child) &&
            getComponentNameFromType(child.type) === "UserProfileEditFormTextField"
          ) acc.push(i);
          return acc;
        }, []);

        if (index.length >= 3) {
          parent.props.children.splice(index[2] + 1, 0, <Builder />);
        }
      }
    } catch {
      // One broken edit-form render shouldn't crash the whole profile edit screen.
    }

    return tree;
  });
};