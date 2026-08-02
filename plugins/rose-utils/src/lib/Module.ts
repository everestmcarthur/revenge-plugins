import { logger } from "@vendetta";
import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";

// Simplified from nexpid's original Module class (nexxutils) - same shape (id/label/settings/
// handlers, per-module enable storage, error tracking), with the fancier UI-kit bits (custom
// error viewer modal, choose-sheets, table rows) traded for this repo's plain @shared components.
export const vstorage = storage as {
    modules: Record<string, { enabled: boolean; options: Record<string, any> }>;
};

export enum ModuleCategory {
    Useful = "Useful",
    Fixes = "Fixes",
    Fun = "Fun"
}

export type ModuleSetting =
    & { label: string; subLabel?: string | ((value: any) => string); predicate?: (this: AnyModule) => boolean }
    & (
        | { type: "toggle"; default: boolean }
        | { type: "button"; action: (this: AnyModule) => void }
        | { type: "choose"; choices: string[]; default: string }
        | { type: "text"; default: string; placeholder?: string }
    );

export interface ModuleMeta {
    sublabel: string;
    category: ModuleCategory;
}

export type AnyModule = Module<Record<string, ModuleSetting>>;

class Patches {
    private store: (() => void)[];

    constructor() {
        this.store = [];
    }

    add(patch: () => void) {
        this.store.push(patch);
    }

    unpatch() {
        for (const p of this.store) {
            try {
                p();
            } catch {
                // A patch failing to undo shouldn't block the others from unwinding.
            }
        }
        this.store = [];
    }
}

export class Module<Settings extends Record<string, ModuleSetting>> {
    id: string;
    label: string;
    meta: ModuleMeta;
    settings: Settings;
    errors: Record<string, string>;
    patches: Patches;

    private handlers: {
        onStart: (this: Module<Settings>) => void;
        onStop: (this: Module<Settings>) => void;
    };
    private started: boolean;
    private listeners: Set<() => void>;

    // Assigned in the constructor body rather than as class-field initializers - this repo's
    // SWC build config lowers `class` to an ES5-style function for compatibility, and that pass
    // doesn't also handle the separate (newer) class-fields proposal, so field initializers like
    // `errors: Record<string, string> = {};` were silently getting dropped from the compiled
    // output entirely. Confirmed by reading the built bundle directly: the compiled constructor
    // only set id/label/meta/settings/handlers, nothing else - every Module instance was missing
    // errors/patches/started/listeners, which crashed the settings screen on `Object.entries
    // (module.errors)` and made every module's own patches silently no-op.
    constructor({ id, label, meta, settings, handlers }: {
        id: string;
        label: string;
        meta: ModuleMeta;
        settings?: Settings;
        handlers: {
            onStart: (this: Module<Settings>) => void;
            onStop: (this: Module<Settings>) => void;
        };
    }) {
        this.id = id;
        this.label = label;
        this.meta = meta;
        this.settings = settings ?? ({} as Settings);
        this.handlers = handlers;
        this.errors = {};
        this.patches = new Patches();
        this.started = false;
        this.listeners = new Set();
    }

    get storage(): { enabled: boolean; options: { [k in keyof Settings]: any } } {
        const options = Object.fromEntries(
            Object.entries(this.settings)
                .filter(([, s]) => "default" in s)
                // @ts-expect-error settings union narrows fine at runtime
                .map(([k, s]) => [k, s.default]),
        );

        vstorage.modules[this.id] ??= { enabled: false, options };
        for (const [k, v] of Object.entries(options)) {
            const opts = vstorage.modules[this.id].options;
            if (typeof v !== typeof opts[k]) opts[k] = v;
        }

        return vstorage.modules[this.id] as any;
    }

    toggle() {
        this.storage.enabled = !this.storage.enabled;
        if (this.storage.enabled) this.start();
        else this.stop();
        this.refresh();
    }

    restart() {
        if (!this.started) return;
        this.stop();
        this.start();
        this.refresh();
    }

    start() {
        if (this.started) return;

        try {
            this.started = true;
            this.handlers.onStart.call(this);
        } catch (e) {
            this.stop();
            this.started = false;
            const err = e instanceof Error ? e : new Error(String(e));

            logger.error(`[RoseUtils/${this.label}] Failed to start: ${err}`);
            this.errors.Start = String(err.stack ?? err);
            showToast(`${this.label} failed to start - see RoseUtils settings for details`, undefined);
        }
        this.refresh();
    }

    stop() {
        if (!this.started) return;

        try {
            this.started = false;
            this.handlers.onStop.call(this);
        } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            logger.error(`[RoseUtils/${this.label}] Failed to stop cleanly: ${err}`);
            this.errors.Stop = String(err.stack ?? err);
        } finally {
            this.patches.unpatch();
        }
        this.refresh();
    }

    refresh() {
        this.listeners.forEach((l) => l());
    }

    useRefresh() {
        const [, forceUpdate] = React.useReducer((n: number) => ~n, 0);
        React.useEffect(() => {
            this.listeners.add(forceUpdate);
            return () => {
                this.listeners.delete(forceUpdate);
            };
        }, []);
    }
}
