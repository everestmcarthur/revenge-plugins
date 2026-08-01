import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import dark from "./dark.png";
import light from "./light.png";

import { Module, ModuleCategory } from "../../lib/Module";

const MediaManager = findByProps("downloadMediaAsset");
const mediaShareActions = findByProps("useMediaShareActions");

function parseURL(url: string) {
    const path = url.split("/");
    const tenorIndex = path.findIndex((x) => x.endsWith(".tenor.com"));
    if (tenorIndex === -1) return;

    const [host, id, file] = path.slice(tenorIndex, tenorIndex + 3);
    if (!host || !id || !file) return;

    return `https://${host}/${id.slice(0, -2)}AC/${file.split(".")[0]}.gif`;
}

export default new Module({
    id: "tenor-gif-fix",
    label: "Tenor GIF Fix",
    meta: {
        sublabel: "Fixes a several-year old bug which downloads gifs from Tenor as videos instead of gif files",
        category: ModuleCategory.Fixes,
    },
    handlers: {
        onStart() {
            // Older Discord versions.
            if (MediaManager?.downloadMediaAsset) {
                this.patches.add(
                    before("downloadMediaAsset", MediaManager, (args: any[]) => {
                        const url = args[0];
                        if (!url || typeof url !== "string") return;

                        const parsed = parseURL(url);
                        if (parsed) {
                            args[0] = parsed;
                            args[1] = 1;
                        }
                    }),
                );
            }

            // Newer Discord versions.
            if (mediaShareActions?.useMediaShareActions) {
                this.patches.add(
                    before("useMediaShareActions", mediaShareActions, (args: any[]) => {
                        const source = args[0]?.source;
                        if (!source?.uri) return;

                        const parsed = parseURL(source.uri);
                        if (parsed) {
                            source.sourceURI = parsed;
                            delete source.videoURI;
                        }
                    }),
                );
            }
        },
        onStop() {},
    },
});
