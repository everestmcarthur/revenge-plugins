import { FluxDispatcher } from "@vendetta/metro/common";
import { before } from "@vendetta/patcher";

const MAX_DISTINCT_TYPES = 500;

// Captures every FluxDispatcher action type dispatched over durationMs and returns a count-sorted
// report. Patches dispatch itself, observing without altering it, and auto-unpatches when the
// window ends or the distinct-type cap is hit.
export function captureFluxEvents(durationMs: number, filter?: string): Promise<string> {
    return new Promise((resolve) => {
        const counts = new Map<string, number>();
        let unpatch = () => {};
        let done = false;

        const finish = () => {
            if (done) return;
            done = true;
            unpatch();

            const needle = filter?.trim();
            const lines = [...counts.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => `${String(count).padStart(5)}  ${type}`);

            resolve(
                lines.length
                    ? `${counts.size} distinct type(s)${needle ? ` matching "${needle}"` : ""} over ${durationMs}ms:\n\n${lines.join("\n")}`
                    : `(no${needle ? ` matching "${needle}"` : ""} events fired during the ${durationMs}ms capture window)`
            );
        };

        try {
            unpatch = before("dispatch", FluxDispatcher, (args: any[]) => {
                const action = args[0];
                const type = action?.type ?? "(no type)";
                const needle = filter?.trim();
                if (needle && !type.includes(needle)) return;
                if (!counts.has(type) && counts.size >= MAX_DISTINCT_TYPES) return;
                counts.set(type, (counts.get(type) ?? 0) + 1);
            });
        } catch (e) {
            resolve(`Failed to patch FluxDispatcher.dispatch: ${e}`);
            return;
        }

        setTimeout(finish, durationMs);
    });
}
