import { registerCommand } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";
import { findAccountByInput, formatAccountName, getAccountOrder, getAccounts, getSettings, TokenManager } from "./lib/accounts";
import { addCurrentAccount, removeAccount, switchToAccount } from "./lib/accountActions";

const STRING = 3;
const MessageActions = findByProps("sendMessage", "sendBotMessage");

function reply(channelId: string, content: string) {
    if (!MessageActions?.sendMessage) {
        showToast("Couldn't send response - message action not found", undefined);
        return;
    }
    MessageActions.sendMessage(channelId, { content, tts: false, invalidEmojis: [], validNonShortcutEmojis: [] }, true, {});
}

export default function loadCommands(): (() => void)[] {
    const unregisterMain = registerCommand({
        name: "accswitcher",
        description: "Open the More Alts account switcher",
        options: [],
        execute: (_args, ctx) => {
            reply(ctx.channel.id, getSettings().addToSidebar
                ? "Account Manager is available in your settings sidebar.\n\nQuick commands:\n`/accswitcher login <#>` `/accswitcher add` `/accswitcher list` `/accswitcher remove <#>`"
                : "Check the plugin's settings page to open the Account Manager.\n\nQuick commands:\n`/accswitcher login <#>` `/accswitcher add` `/accswitcher list` `/accswitcher remove <#>`");
        }
    });

    const unregisterAdd = registerCommand({
        name: "accswitcher add",
        description: "Add your current account to saved accounts",
        options: [],
        execute: async (_args, ctx) => {
            const ok = await addCurrentAccount();
            if (ok) reply(ctx.channel.id, "✅ Current account saved.");
        }
    });

    const unregisterLogin = registerCommand({
        name: "accswitcher login",
        description: "Switch to a saved account",
        options: [{ name: "account", description: "Account number or username", type: STRING, required: true }],
        execute: async (args, ctx) => {
            const input = args.find((a) => a.name === "account")?.value;
            if (!input) return;

            const found = findAccountByInput(input);
            if (!found) {
                reply(ctx.channel.id, `❌ Could not find account "${input}". Use \`/accswitcher list\` to see saved accounts.`);
                return;
            }

            const [accountId] = found;
            await switchToAccount(accountId);
        }
    });

    const unregisterList = registerCommand({
        name: "accswitcher list",
        description: "Show all saved accounts",
        options: [],
        execute: (_args, ctx) => {
            const order = getAccountOrder();
            if (!order.length) {
                reply(ctx.channel.id, "No saved accounts. Use `/accswitcher add` to save your current account.");
                return;
            }

            const accounts = getAccounts();
            const lines = order
                .filter((id) => accounts[id])
                .map((id, i) => `**${i + 1}.** ${formatAccountName(accounts[id])}`)
                .join("\n");
            reply(ctx.channel.id, `**Saved accounts (${order.length})**\n${lines}\n\nUse \`/accswitcher login <number>\` to switch.`);
        }
    });

    const unregisterRemove = registerCommand({
        name: "accswitcher remove",
        description: "Remove a saved account",
        options: [{ name: "account", description: "Account number or username", type: STRING, required: true }],
        execute: (args, ctx) => {
            const input = args.find((a) => a.name === "account")?.value;
            if (!input) return;

            const found = findAccountByInput(input);
            if (!found) {
                reply(ctx.channel.id, `❌ Could not find account "${input}".`);
                return;
            }

            const [accountId] = found;
            removeAccount(accountId);
        }
    });

    const unregisterToken = registerCommand({
        name: "accswitcher token",
        description: "Get your current account token (requires unsafe features)",
        options: [],
        execute: (_args, ctx) => {
            if (!getSettings().enableUnsafeFeatures) {
                showToast("Enable 'Unsafe features' in plugin settings to use this command", undefined);
                return;
            }
            reply(ctx.channel.id, `||${TokenManager.getToken()}||\n⚠️ Keep this secure and never share it.`);
        }
    });

    return [unregisterMain, unregisterAdd, unregisterLogin, unregisterList, unregisterRemove, unregisterToken];
}
