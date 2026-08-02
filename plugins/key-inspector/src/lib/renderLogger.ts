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

/**
 * Captures the props a component actually receives, for up to `maxCalls` renders or `durationMs`
 * (whichever comes first) - built for the everyday "what shape are these props really" question
 * that normally means digging through decompiled source. Only works for components exported as a
 * React.memo/forwardRef wrapper (i.e. they have a `.type` property React calls through) - that
 * covers most of what findByTypeName/findByName actually return, but a bare unwrapped function
 * component can't be patched this way (there's no property to intercept a plain function's own
 * call through; you'd need the module object it's exported from instead - grab that with the Eval
 * tool and `before("default", thatModule, ...)` the same way this file does).
 */
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
