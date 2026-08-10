import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { fetchDefinition } from "./lib/urbanDictionary";

const STRING = 3;

const MessageActions = findByProps("sendMessage", "sendBotMessage");

export default function loadCommands(): (() => void)[] {
    const unregister = registerCommand({
        name: "urban",
        description: "Look up a term on Urban Dictionary",
        options: [{ name: "term", description: "What to look up", type: STRING, required: true }],
        execute: async (args, ctx) => {
            const term = args.find((a) => a.name === "term")?.value;
            if (!term) return;

            let definition;
            try {
                definition = await fetchDefinition(term);
            } catch {
                showToast(`Couldn't reach Urban Dictionary for "${term}"`, undefined);
                return;
            }

            if (!definition) {
                showToast(`No definition found for "${term}"`, undefined);
                return;
            }

            if (!MessageActions?.sendMessage) {
                showToast("Couldn't send the definition - message action not found", undefined);
                return;
            }

            const content =
                `**${definition.word}** (👍 ${definition.thumbsUp} 👎 ${definition.thumbsDown})\n${definition.definition}` +
                (definition.example ? `\n\n*${definition.example}*` : "");

            // sendMessage silently rejects (TypeError reading nonce) without a 3rd/4th arg, even
            // though its own signature only shows two params - both are required to actually send.
            MessageActions.sendMessage(
                ctx.channel.id,
                { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
                true,
                {}
            );
        }
    });

    return [unregister];
}
