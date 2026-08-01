import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { showConfirmationAlert } from "@vendetta/ui/alerts";

export interface Reminder {
    id: string;
    dueAt: number;
    text: string;
}

export function getReminders(): Reminder[] {
    storage.reminders ??= [];
    return storage.reminders;
}

export function addReminder(text: string, delayMs: number) {
    getReminders().push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        dueAt: Date.now() + delayMs,
        text
    });
}

export function removeReminder(id: string) {
    const list = getReminders();
    const idx = list.findIndex((r) => r.id === id);
    if (idx !== -1) list.splice(idx, 1);
}

function fire(reminder: Reminder) {
    try {
        showConfirmationAlert({
            title: "⏰ Reminder",
            content: reminder.text,
            confirmText: "Got it"
        });
    } catch {
        showToast(`⏰ ${reminder.text}`, undefined);
    }
}

let interval: any;

// Pure-JS timers only run while the app process is alive - this can't wake Discord up from fully closed,
// only fire while it's open (foreground or backgrounded-but-running).
export function startScheduler() {
    stopScheduler();

    interval = setInterval(() => {
        const now = Date.now();
        const due = getReminders().filter((r) => r.dueAt <= now);
        if (!due.length) return;

        due.forEach((r) => {
            fire(r);
            removeReminder(r.id);
        });
    }, 15000);
}

export function stopScheduler() {
    if (interval) clearInterval(interval);
    interval = undefined;
}
