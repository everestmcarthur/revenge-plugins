import { findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { isElement, getComponentNameFromType, type RN } from "@fpte/lib/reactNativeRenderTree";

const funcParent = findByName("UserProfileEditForm", false);

function removeNitroCards(node: RN.Node): RN.Node | null {
  if (!node) return null;

  if (
    isElement(node) &&
    getComponentNameFromType(node.type) === "UserProfilePremiumUpsellCard"
  ) {
    return null;
  }

  if (node.props?.children) {
    let children = node.props.children;
    if (!Array.isArray(children)) children = [children];

    const filteredChildren = children
      .map(removeNitroCards)
      .filter((child): child is RN.Node => child !== null);

    node.props.children = filteredChildren.length === 1 ? filteredChildren[0] : filteredChildren;
  }

  return node;
}

export const patchNitroUpsellCard = () => {
  if (!funcParent) return () => {};

  return after("default", funcParent, (_args: unknown[], tree: RN.Node) => {
    try {
      return removeNitroCards(tree) || tree;
    } catch {
      // One broken upsell-card removal shouldn't crash the whole profile edit screen.
      return tree;
    }
  });
};