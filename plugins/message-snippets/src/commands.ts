import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { getSnippets, saveSnippet, deleteSnippet } from "./lib/snippets";

// Discord slash-command option type for a plain string argument.
const STRING = 3;

export default function loadCommands(): (() => void)[] {
    const unregisterSend = registerCommand({
        name: "snippet",
        description: "Send a saved text snippet",
        options: [{ name: "name", description: "Snippet name", type: STRING, required: true }],
        execute: (args) => {
            const name = args.find((a) => a.name === "name")?.value;
            const text = name ? getSnippets()[name] : undefined;

            if (!text) {
                showToast(`No snippet named "${name}"`, undefined);
                return;
            }

            return { content: text };
        }
    });

    const unregisterSave = registerCommand({
        name: "snippet-save",
        description: "Save a text snippet",
        options: [
            { name: "name", description: "Snippet name", type: STRING, required: true },
            { name: "text", description: "Snippet content", type: STRING, required: true }
        ],
        execute: (args) => {
            const name = args.find((a) => a.name === "name")?.value;
            const text = args.find((a) => a.name === "text")?.value;
            if (!name || !text) return;

            saveSnippet(name, text);
            showToast(`Saved snippet "${name}"`, undefined);
        }
    });

    const unregisterDelete = registerCommand({
        name: "snippet-delete",
        description: "Delete a saved text snippet",
        options: [{ name: "name", description: "Snippet name", type: STRING, required: true }],
        execute: (args) => {
            const name = args.find((a) => a.name === "name")?.value;
            if (!name) return;

            deleteSnippet(name);
            showToast(`Deleted snippet "${name}"`, undefined);
        }
    });

    const unregisterList = registerCommand({
        name: "snippet-list",
        description: "List your saved snippet names",
        options: [],
        execute: () => {
            const names = Object.keys(getSnippets());
            showToast(names.length ? names.join(", ") : "No snippets saved yet", undefined);
        }
    });

    return [unregisterSend, unregisterSave, unregisterDelete, unregisterList];
}
