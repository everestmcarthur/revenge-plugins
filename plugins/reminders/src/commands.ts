import { registerCommand } from "@vendetta/commands";
import { showToast } from "@vendetta/ui/toasts";
import { parseDuration } from "./lib/duration";
import { addReminder } from "./lib/reminders";

const STRING = 3;

export default function loadCommands(): (() => void)[] {
    const unregisterRemind = registerCommand({
        name: "remind",
        description: "Set a reminder, e.g. /remind 20m Walk the dog",
        options: [
            { name: "in", description: "e.g. 10m, 2h, 1d", type: STRING, required: true },
            { name: "text", description: "What to remind you about", type: STRING, required: true }
        ],
        execute: (args) => {
            const inValue = args.find((a) => a.name === "in")?.value;
            const text = args.find((a) => a.name === "text")?.value;
            const delay = inValue ? parseDuration(inValue) : undefined;

            if (!delay || !text) {
                showToast(`Couldn't parse "${inValue}" - try something like 10m, 2h, or 1d`, undefined);
                return;
            }

            addReminder(text, delay);
            showToast(`Reminder set for ${inValue} from now`, undefined);
        }
    });

    return [unregisterRemind];
}
