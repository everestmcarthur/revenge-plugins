import { FluxDispatcher } from "@vendetta/metro/common";

/** Subscribes to a Flux event; returns an unsubscribe function. Pass once=true to auto-unsubscribe after the first fire. */
export function fluxSubscribe(event: string, callback: (...args: any[]) => void, once = false): () => void {
    const listener = (...args: any[]) => {
        if (once) FluxDispatcher.unsubscribe(event, listener);
        callback(...args);
    };
    FluxDispatcher.subscribe(event, listener);
    return () => FluxDispatcher.unsubscribe(event, listener);
}
