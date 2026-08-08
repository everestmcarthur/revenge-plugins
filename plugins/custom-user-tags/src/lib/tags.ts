import { storage } from "@vendetta/plugin";

export interface UserTag {
    text: string;
    color: string;
    icon?: string;
}

export function allTags(): Record<string, UserTag> {
    storage.tags ??= {};
    return storage.tags;
}

export function getUserTag(userId: string | undefined): UserTag | undefined {
    if (!userId) return undefined;
    return allTags()[userId];
}

export function setUserTag(userId: string, tag: UserTag): void {
    allTags()[userId] = tag;
}

export function removeUserTag(userId: string): void {
    delete allTags()[userId];
}
