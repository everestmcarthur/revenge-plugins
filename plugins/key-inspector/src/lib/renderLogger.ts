import { findByName, findByTypeName } from "@vendetta/metro";
import { before } from "@vendetta/patcher";

function safeStringify(value: any): string {
    try {
        return JSON.stringify(value, (_k, v) => (typeof v === "function" ? `[Function: ${v.name || "anonymous"}]` : v), 2);
    } catch {
        try {
            return `[unserializable, keys: ${Object.keys(value ?? {}).join(", ")}]`;
        } catch {
            return String(value);
        }
    }
}

// Captures the props a component actually receives, for up to maxCalls renders or durationMs.
// Only works for React.memo/forwardRef-wrapped components (they have a .type property to patch) -
// a bare function component has no property to intercept its own calls through.
export function captureComponentRenders(componentName: string, maxCalls: number, durationMs: number): Promise<string> {
    return new Promise((resolve) => {
        const name = componentName.trim();
        const target: any = findByTypeName(name) ?? findByName(name, false);

        if (!target) {
            resolve(`"${name}" not found via findByTypeName or findByName.`);
            return;
        }
        if (typeof target.type !== "function") {
            resolve(
                `Found "${name}", but it has no callable .type property (not a memo/forwardRef ` +
                `wrapper), so its own render calls can't be intercepted this way. Its keys: ` +
                `${Object.keys(target).join(", ")}`
            );
            return;
        }

        const calls: string[] = [];
        let done = false;
        let unpatch = () => {};

        const finish = () => {
            if (done) return;
            done = true;
            unpatch();
            resolve(calls.length ? calls.join("\n\n---\n\n") : `"${name}" never rendered during the ${durationMs}ms capture window.`);
        };

        try {
            unpatch = before("type", target, (args: any[]) => {
                calls.push(`Call ${calls.length + 1} props:\n${safeStringify(args[0])}`);
                if (calls.length >= maxCalls) finish();
            });
        } catch (e) {
            resolve(`Failed to patch "${name}": ${e}`);
            return;
        }

        setTimeout(finish, durationMs);
    });
}
