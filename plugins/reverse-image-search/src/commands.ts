import { registerCommand } from "@vendetta/commands";
import { ReactNative } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";

const STRING = 3;

interface Engine {
    name: string;
    url: (imageUrl: string) => string;
}

const ENGINES: Engine[] = [
    { name: "google", url: (u) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u)}` },
    { name: "yandex", url: (u) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(u)}` },
    { name: "tineye", url: (u) => `https://tineye.com/search?url=${encodeURIComponent(u)}` }
];

export default function loadCommands(): (() => void)[] {
    const unregister = registerCommand({
        name: "reverse-image-search",
        description: "Open an image URL in a reverse image search engine",
        options: [
            { name: "image-url", description: "Direct link to the image (long-press an image → Copy Media Link)", type: STRING, required: true },
            { name: "engine", description: "google, yandex, or tineye (default: google)", type: STRING, required: false }
        ],
        execute: (args) => {
            const imageUrl = args.find((a) => a.name === "image-url")?.value;
            if (!imageUrl) return;

            const engineName = (args.find((a) => a.name === "engine")?.value || "google").toLowerCase();
            const engine = ENGINES.find((e) => e.name === engineName) ?? ENGINES[0];

            ReactNative.Linking.openURL(engine.url(imageUrl)).catch(() => {
                showToast("Couldn't open the browser for this search", undefined);
            });
        }
    });

    return [unregister];
}
