const MAX_KEYS_PER_LEVEL = 60;

// This is Discord's entire live module registry (thousands of entries) - useful to search
// individually (see the manual findByProps/findByName tools), not to dump wholesale here.
const SKIP_PATHS = new Set(["vendetta.metro.modules"]);

function kindOf(value: any): string {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return `array(${value.length})`;
    return typeof value;
}

/**
 * Recursively walks the stable `window.vendetta` API surface exposed to every plugin and lists
 * every key path found, bounded so it stays useful instead of dumping megabytes of Discord internals.
 * This is the actual compat API plugins are built against - not Discord's full module registry.
 */
export function dumpVendettaApiTree(maxDepth = 3): string {
    const seen = new WeakSet<object>();
    const lines: string[] = [];

    function walk(obj: any, path: string, depth: number) {
        if (obj == null || (typeof obj !== "object" && typeof obj !== "function")) return;

        if (SKIP_PATHS.has(path)) {
            lines.push(`${path} -> (skipped - Discord's full module registry, use the search tools for this)`);
            return;
        }

        if (typeof obj === "object") {
            if (seen.has(obj)) {
                lines.push(`${path} -> [already listed elsewhere, circular]`);
                return;
            }
            seen.add(obj);
        }

        let keys: string[];
        try {
            keys = Object.keys(obj).sort();
        } catch (e) {
            lines.push(`${path} -> [couldn't read keys: ${e}]`);
            return;
        }

        const limited = keys.slice(0, MAX_KEYS_PER_LEVEL);
        for (const key of limited) {
            const fullPath = `${path}.${key}`;
            let value: any;
            try {
                value = obj[key];
            } catch (e) {
                lines.push(`${fullPath} -> [threw on access: ${e}]`);
                continue;
            }

            const kind = kindOf(value);
            lines.push(`${fullPath} (${kind})`);

            if (kind === "object" && depth < maxDepth) {
                walk(value, fullPath, depth + 1);
            }
        }

        if (keys.length > MAX_KEYS_PER_LEVEL) {
            lines.push(`${path} -> (+${keys.length - MAX_KEYS_PER_LEVEL} more keys not shown at this level)`);
        }
    }

    try {
        walk((globalThis as any).vendetta, "vendetta", 0);
    } catch (e) {
        lines.push(`Error walking the vendetta object: ${e}`);
    }

    if (!lines.length) return "vendetta object not found or empty";
    return lines.join("\n");
}
