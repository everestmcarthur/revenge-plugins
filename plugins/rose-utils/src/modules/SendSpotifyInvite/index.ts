import { findByTypeName } from "@vendetta/metro";
import { React } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import dark from "./dark.png";
import light from "./light.png";

import { Module, ModuleCategory } from "../../lib/Module";
import InviteButton from "./components/InviteButton";

const MediaKeyboardListHeader = findByTypeName("MediaKeyboardListHeader", false);

export default new Module({
    id: "send-spotify-invite",
    label: "Send Spotify invite",
    meta: {
        sublabel: "Adds a button in the chat attachment menu to invite the channel to listen along to Spotify",
        category: ModuleCategory.Useful,
    },
    handlers: {
        onStart() {
            if (!MediaKeyboardListHeader) return;

            this.patches.add(
                after("type", MediaKeyboardListHeader, (_: any, ret: any) => {
                    if (!ret?.props || !Array.isArray(ret.props.children)) return;

                    return {
                        ...ret,
                        props: {
                            ...ret.props,
                            children: [...ret.props.children, React.createElement(InviteButton, {})],
                        },
                    };
                }),
            );
        },
        onStop() {},
    },
});
