import { findByProps, findByStoreName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";

export interface Account {
    id: string;
    username: string;
    discriminator: string;
    avatar: string | null;
    displayName: string;
    token: string;
    addedAt: number;
}

export interface MoreAltsSettings {
    enableCLI: boolean;
    confirmBeforeDelete: boolean;
    enableUnsafeFeatures: boolean;
    addToSidebar: boolean;
    enableNativeSwitcher: boolean;
    exportPasswordHash?: string;
}

export const UserStore = findByStoreName("UserStore");
export const TokenManager = findByProps("getToken");
export const AuthActions = findByProps("login", "logout", "switchAccountToken");

export function ensureStorage() {
    storage.accounts ??= {};
    storage.accountOrder ??= [];
    storage.settings ??= {
        enableCLI: true,
        confirmBeforeDelete: true,
        enableUnsafeFeatures: false,
        addToSidebar: true,
        enableNativeSwitcher: true
    } satisfies MoreAltsSettings;
}

export function getAccounts(): Record<string, Account> {
    ensureStorage();
    return storage.accounts;
}

export function getAccountOrder(): string[] {
    ensureStorage();
    return storage.accountOrder;
}

export function getSettings(): MoreAltsSettings {
    ensureStorage();
    return storage.settings;
}

export function orderedAccounts(): Account[] {
    return getAccountOrder()
        .filter((id) => getAccounts()[id])
        .map((id) => getAccounts()[id]);
}

export function formatAccountName(account?: Account | null): string {
    return account?.username ?? "Unknown Account";
}

export function getAccountIndex(accountId: string): number | null {
    const index = getAccountOrder().indexOf(accountId);
    return index >= 0 ? index + 1 : null;
}

export function addAccountToOrder(accountId: string) {
    const order = getAccountOrder();
    if (!order.includes(accountId)) order.push(accountId);
}

export function removeAccountFromOrder(accountId: string) {
    const order = getAccountOrder();
    const idx = order.indexOf(accountId);
    if (idx > -1) order.splice(idx, 1);
}

export function findAccountByInput(input: string): [string, Account] | null {
    const accounts = getAccounts();
    const order = getAccountOrder();

    const index = parseInt(input, 10);
    if (!isNaN(index) && index >= 1 && index <= order.length) {
        const accountId = order[index - 1];
        return accounts[accountId] ? [accountId, accounts[accountId]] : null;
    }

    const entry = Object.entries(accounts).find(
        ([, account]) => account.username.toLowerCase() === input.toLowerCase()
    );
    return entry ? (entry as [string, Account]) : null;
}
