import { findByProps, findByStoreName } from "@vendetta/metro";
import { clipboard, FluxDispatcher } from "@vendetta/metro/common";
import { showToast } from "@vendetta/ui/toasts";
import { isConfigured, isExcludedDomain, shortenUrl, uploadFromUrl, zStorage } from "../lib/api";

const TAG = "[Zipline]";
const URL_REGEX = /https?:\/\/[^\s<>"]+/g;

const UserStore = findByStoreName("UserStore");
const MessageActions = findByProps("sendMessage", "editMessage") as any;

const MAX_TRACKED = 200;
const processedMessages = new Set<string>();

function alreadyProcessed(key: string): boolean {
    if (processedMessages.has(key)) return true;
    processedMessages.add(key);
    if (processedMessages.size > MAX_TRACKED) {
        processedMessages.delete(processedMessages.values().next().value);
    }
    return false;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            (v) => { clearTimeout(timer); resolve(v); },
            (e) => { clearTimeout(timer); reject(e); },
        );
    });
}

async function handleMessageCreate(event: any) {
    const message = event?.message;
    if (!message?.id) return;
    if (message.state === "SENDING") return;
    if (!isConfigured()) return;

    const currentUserId = UserStore?.getCurrentUser?.()?.id;
    if (!currentUserId || message.author?.id !== currentUserId) return;

    const attachments: any[] = message.attachments ?? [];
    const wantsUpload = zStorage().autoUpload && attachments.length > 0;
    const wantsShorten = zStorage().autoShorten && !!message.content;
    if (!wantsUpload && !wantsShorten) return;
    if (alreadyProcessed(message.nonce ?? message.id)) return;

    let content: string = message.content ?? "";
    const uploadedUrls: string[] = [];

    if (wantsUpload) {
        for (const att of attachments) {
            try {
                const uploaded = await uploadFromUrl(att.url, att.filename ?? "file", att.content_type ?? "application/octet-stream");
                uploadedUrls.push(uploaded.url);
            } catch (e: any) {
                console.error(TAG, "Failed to upload", att?.filename, e?.message ?? e);
            }
        }
        if (uploadedUrls.length) content = [content, ...uploadedUrls].filter(Boolean).join("\n");
    }

    if (wantsShorten) {
        const rawMatches = content.match(URL_REGEX) ?? [];
        const urls = [...new Set(rawMatches)].filter((u) => !isExcludedDomain(u));
        for (const url of urls) {
            try {
                const short = await shortenUrl(url);
                content = content.split(url).join(short);
            } catch (e: any) {
                console.error(TAG, "Failed to shorten", url, e?.message ?? e);
            }
        }
    }

    if (content === (message.content ?? "")) return;

    try {
        if (uploadedUrls.length) {
            await withTimeout(MessageActions.deleteMessage(message.channel_id, message.id), 15000, "deleteMessage timed out");
            await withTimeout(
                MessageActions.sendMessage(
                    message.channel_id,
                    { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] },
                    true,
                    {},
                ),
                15000,
                "sendMessage timed out",
            );
            clipboard.setString(uploadedUrls[uploadedUrls.length - 1]);
        } else {
            await withTimeout(MessageActions.editMessage(message.channel_id, message.id, { content }), 15000, "editMessage timed out");
        }
    } catch (e: any) {
        console.error(TAG, "Failed to replace message content:", e?.message ?? e);
        showToast(`Zipline: failed to update message (${e?.message ?? e})`, undefined);
    }
}

export default function patchAutoProcess(): () => void {
    FluxDispatcher.subscribe("MESSAGE_CREATE", handleMessageCreate);
    return () => FluxDispatcher.unsubscribe("MESSAGE_CREATE", handleMessageCreate);
}
