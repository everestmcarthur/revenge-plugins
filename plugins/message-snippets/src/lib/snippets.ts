import { storage } from "@vendetta/plugin";

export function getSnippets(): Record<string, string> {
    storage.snippets ??= {};
    return storage.snippets;
}

export function saveSnippet(name: string, text: string) {
    getSnippets()[name.trim()] = text;
}

export function deleteSnippet(name: string) {
    delete getSnippets()[name];
}
