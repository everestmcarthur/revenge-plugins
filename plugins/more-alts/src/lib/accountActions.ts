import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { showToast } from "@vendetta/ui/toasts";
import { clipboard, ReactNative } from "@vendetta/metro/common";
import {
    Account,
    AuthActions,
    TokenManager,
    UserStore,
    addAccountToOrder,
    getAccounts,
    getSettings,
    formatAccountName,
    removeAccountFromOrder
} from "./accounts";
import { addLog } from "./logger";
import { simpleHash } from "./passwordUtils";

export type RequirePassword = (opts: { title: string; message: string; onSuccess: () => void }) => void;

export function exportAccounts(requirePassword: RequirePassword) {
    const run = () => {
        showConfirmationAlert({
            title: "⚠️ Export Accounts - Security Warning",
            content: "Exporting accounts is UNSAFE and may lead to account takeover if shared with others. The export contains sensitive authentication tokens that give full access to your accounts. Only proceed if you understand the risks and will keep the data secure.",
            confirmText: "I Understand - Export",
            cancelText: "Cancel",
            confirmColor: "brand",
            onConfirm: () => {
                try {
                    const accounts = getAccounts();
                    const accountData = Object.values(accounts).map((account) => ({
                        username: account.username,
                        discriminator: account.discriminator,
                        avatar: account.avatar,
                        id: account.id,
                        token: account.token,
                        addedAt: account.addedAt
                    }));

                    const exportData = {
                        accounts: accountData,
                        exportPasswordHash: getSettings().exportPasswordHash ?? null,
                        exportedAt: Date.now(),
                        version: "2.0"
                    };

                    clipboard.setString(JSON.stringify(exportData, null, 2));
                    addLog("info", "Accounts exported successfully", { count: accountData.length });
                    showToast(`Exported ${accountData.length} accounts to clipboard`, undefined);
                } catch (e: any) {
                    addLog("error", "Failed to export accounts", { error: e?.message });
                    showToast("Failed to export accounts", undefined);
                }
            }
        });
    };

    if (getSettings().exportPasswordHash) {
        requirePassword({ title: "Enter Export Password", message: "Enter your password to export accounts", onSuccess: run });
    } else {
        run();
    }
}

export async function importAccounts(requirePassword: RequirePassword, importText: string, onComplete?: () => void) {
    const run = async () => {
        showConfirmationAlert({
            title: "⚠️ Import Accounts - Security Warning",
            content: "Importing accounts is UNSAFE and may compromise your security if the data comes from untrusted sources. Only import data you exported yourself or from sources you completely trust. Malicious imports could lead to account takeover.",
            confirmText: "I Understand - Import",
            cancelText: "Cancel",
            confirmColor: "brand",
            onConfirm: async () => {
                try {
                    let dataToImport = importText.trim();
                    if (!dataToImport) {
                        try {
                            dataToImport = await clipboard.getString();
                        } catch (e: any) {
                            addLog("error", "Failed to get clipboard data", { error: e?.message });
                            showToast("No data in clipboard or input field", undefined);
                            return;
                        }
                    }

                    if (!dataToImport) {
                        showToast("No data to import", undefined);
                        return;
                    }

                    const importData = JSON.parse(dataToImport);
                    let accountsArray: any[];
                    const settings = getSettings();

                    if (importData.accounts && Array.isArray(importData.accounts)) {
                        if (importData.exportPasswordHash) {
                            if (!settings.exportPasswordHash || settings.exportPasswordHash !== importData.exportPasswordHash) {
                                addLog("error", "Import password mismatch");
                                showToast("Import password mismatch or not set locally", undefined);
                                return;
                            }
                        }
                        accountsArray = importData.accounts;
                        if (importData.exportPasswordHash && !settings.exportPasswordHash) {
                            settings.exportPasswordHash = importData.exportPasswordHash;
                        }
                    } else if (Array.isArray(importData)) {
                        accountsArray = importData;
                    } else {
                        addLog("error", "Invalid import format");
                        showToast("Invalid import format", undefined);
                        return;
                    }

                    const accounts = getAccounts();
                    let importedCount = 0;
                    let skippedCount = 0;

                    for (const accountData of accountsArray) {
                        if (accountData.id && accountData.token && accountData.username) {
                            if (!accounts[accountData.id]) {
                                accounts[accountData.id] = {
                                    id: accountData.id,
                                    username: accountData.username,
                                    discriminator: accountData.discriminator ?? "0",
                                    avatar: accountData.avatar ?? null,
                                    displayName: accountData.displayName ?? accountData.username,
                                    token: accountData.token,
                                    addedAt: accountData.addedAt ?? Date.now()
                                };
                                addAccountToOrder(accountData.id);
                                importedCount++;
                            } else {
                                skippedCount++;
                            }
                        }
                    }

                    addLog("info", "Import completed", { imported: importedCount, skipped: skippedCount });
                    showToast(`Imported ${importedCount} accounts, skipped ${skippedCount} duplicates`, undefined);
                    onComplete?.();
                } catch (e: any) {
                    addLog("error", "Import failed", { error: e?.message });
                    showToast("Failed to import - invalid format or password mismatch", undefined);
                }
            }
        });
    };

    if (getSettings().exportPasswordHash) {
        requirePassword({ title: "Enter Import Password", message: "Enter your password to import accounts", onSuccess: run });
    } else {
        run();
    }
}

export function setExportPassword(newPassword: string, confirmPassword: string): boolean {
    if (!newPassword.trim()) {
        showToast("Please enter a password", undefined);
        return false;
    }
    if (newPassword !== confirmPassword) {
        showToast("Passwords don't match", undefined);
        return false;
    }

    getSettings().exportPasswordHash = simpleHash(newPassword);
    addLog("info", "Export password set successfully");
    showToast("Export password set successfully", undefined);
    return true;
}

export function removeExportPassword(requirePassword: RequirePassword, onComplete?: () => void) {
    requirePassword({
        title: "Enter Password to Remove",
        message: "Enter your current password to remove protection",
        onSuccess: () => {
            showConfirmationAlert({
                title: "Remove Export Password",
                content: "Are you sure you want to remove the export password? This will make exports/imports less secure.",
                confirmText: "Remove Password",
                cancelText: "Cancel",
                confirmColor: "brand",
                onConfirm: () => {
                    delete getSettings().exportPasswordHash;
                    addLog("info", "Export password removed");
                    showToast("Export password removed", undefined);
                    onComplete?.();
                }
            });
        }
    });
}

export async function addAccountWithToken(rawToken: string): Promise<boolean> {
    if (!getSettings().enableUnsafeFeatures) return false;

    let token = rawToken.trim();
    if (!token) token = TokenManager.getToken();

    if (!token.startsWith("Bot ") && !token.match(/^[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}$/)) {
        showToast("Invalid token format", undefined);
        return false;
    }

    try {
        const response = await fetch("https://discord.com/api/v9/users/@me", {
            headers: { Authorization: token, "Content-Type": "application/json" }
        });

        if (!response.ok) {
            addLog("error", "Discord API request failed", { status: response.status });
            showToast("Invalid or expired token", undefined);
            return false;
        }

        const user = await response.json();
        const accounts = getAccounts();

        if (accounts[user.id]) {
            showToast(`Account ${user.username} already saved`, undefined);
            return false;
        }

        accounts[user.id] = {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            displayName: user.global_name || user.username,
            token,
            addedAt: Date.now()
        };
        addAccountToOrder(user.id);

        addLog("info", "Account added successfully via token", { username: user.username });
        showToast(`Account ${user.username} added!`, undefined);
        return true;
    } catch (e: any) {
        addLog("error", "Failed to add account via token", { error: e?.message });
        showToast("Failed to add account", undefined);
        return false;
    }
}

export async function addAccountWithCredentials(email: string, password: string): Promise<boolean> {
    if (!email.trim() || !password.trim()) {
        showToast("Please enter both email and password", undefined);
        return false;
    }

    try {
        const response = await fetch("https://discord.com/api/v9/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login: email.trim(), password: password.trim() })
        });

        const loginData = await response.json();

        if (!response.ok || !loginData.token) {
            let errorMessage = "Login failed";
            if (loginData.captcha_key) {
                errorMessage = "Captcha required - please login through Discord first";
            } else if (loginData.message) {
                const msg = loginData.message.toLowerCase();
                if (msg.includes("password")) errorMessage = "Invalid password";
                else if (msg.includes("mfa") || msg.includes("2fa")) errorMessage = "2FA/MFA accounts not supported via credentials";
                else if (msg.includes("invalid")) errorMessage = "Invalid email or username";
                else errorMessage = "Login failed - check your credentials";
            } else if (response.status === 429) {
                errorMessage = "Rate limited - please wait and try again";
            }
            showToast(errorMessage, undefined);
            return false;
        }

        const userResponse = await fetch("https://discord.com/api/v9/users/@me", {
            headers: { Authorization: loginData.token }
        });
        if (!userResponse.ok) {
            showToast("Login succeeded but failed to get user info", undefined);
            return false;
        }

        const user = await userResponse.json();
        const accounts = getAccounts();

        if (accounts[user.id]) {
            showToast(`Account ${user.username} already saved`, undefined);
            return false;
        }

        accounts[user.id] = {
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            displayName: user.global_name || user.username,
            token: loginData.token,
            addedAt: Date.now()
        };
        addAccountToOrder(user.id);

        addLog("info", "Account added successfully via credentials", { username: user.username });
        showToast(`Account ${user.username} added successfully!`, undefined);
        return true;
    } catch (e: any) {
        addLog("error", "Credential login failed", { error: e?.message });
        showToast("Login failed - check your connection and try again", undefined);
        return false;
    }
}

export function forceLogout() {
    showConfirmationAlert({
        title: "Force Logout",
        content: "This will logout your current session by using an invalid token. Your saved accounts will remain intact. Continue?",
        confirmText: "Force Logout",
        cancelText: "Cancel",
        confirmColor: "brand",
        onConfirm: async () => {
            try {
                const fakeToken = ["MTExMTExMTExMTExMTExMTEx", "GxxxXx", "xXxXxXxXxXxXxXxXxXxXxXxXxXxXx"].join(".");
                await AuthActions.switchAccountToken(fakeToken);
                addLog("info", "Force logout completed successfully");
                showToast("Force logout successful - you can now login to a different account", undefined);
            } catch (e: any) {
                addLog("warn", "Force logout completed with error", { error: e?.message });
                showToast("Force logout completed", undefined);
            }
        }
    });
}

export async function switchToAccount(accountId: string): Promise<boolean> {
    const account = getAccounts()[accountId];
    if (!account) return false;

    try {
        showToast(`Switching to ${account.username}...`, undefined);
        await AuthActions.switchAccountToken(account.token);
        addLog("info", "Account switch successful", { username: account.username });
        showToast(`Switched to ${account.username}!`, undefined);
        return true;
    } catch (e: any) {
        addLog("error", "Account switch failed", { username: account.username, error: e?.message });
        showToast(`Failed to switch: ${e?.message}`, undefined);
        return false;
    }
}

export function copyToken(accountId: string) {
    if (!getSettings().enableUnsafeFeatures) return;
    const account = getAccounts()[accountId];
    if (!account) return;

    clipboard.setString(account.token);
    addLog("info", "Token copied to clipboard", { username: account.username });
    showToast(`Token for ${account.username} copied`, undefined);
}

function deleteFromStorage(accountId: string) {
    delete getAccounts()[accountId];
    removeAccountFromOrder(accountId);
}

export function removeAccount(accountId: string, onComplete?: () => void) {
    const account = getAccounts()[accountId];
    if (!account) return;

    const currentUserId = UserStore.getCurrentUser()?.id;
    const isCurrent = accountId === currentUserId;
    const accountName = account.username;

    const removeFromSwitcherOnly = () => {
        deleteFromStorage(accountId);
        addLog("info", "Account removed from switcher only", { username: accountName });
        showToast(`Account ${accountName} removed from switcher`, undefined);
        onComplete?.();
    };

    const logoutAndDelete = async () => {
        try {
            const currentToken = TokenManager.getToken();
            await AuthActions.switchAccountToken(account.token);
            await AuthActions.logout();
            setTimeout(() => AuthActions.switchAccountToken(currentToken).catch(() => {}), 100);
        } catch (e: any) {
            addLog("error", "Failed to logout account from Discord", { error: e?.message });
            showToast("Failed to logout, but removed from switcher", undefined);
        }
        deleteFromStorage(accountId);
        addLog("info", "Account removed and logged out", { username: accountName });
        showToast(`Account ${accountName} removed and logged out`, undefined);
        onComplete?.();
    };

    if (!getSettings().confirmBeforeDelete) {
        if (isCurrent) removeFromSwitcherOnly();
        else logoutAndDelete();
        return;
    }

    ReactNative.Alert.alert(
        isCurrent ? "Remove Current Account" : "Remove Account",
        isCurrent
            ? "Do you want to remove the current account from the switcher? (To logout, use Force Logout in settings)"
            : `What do you want to do with ${accountName}?`,
        [
            { text: "Cancel", style: "cancel" },
            { text: "Delete from switcher only", onPress: removeFromSwitcherOnly },
            !isCurrent && { text: "Delete and logout", onPress: logoutAndDelete }
        ].filter(Boolean) as any
    );
}

export async function addCurrentAccount(): Promise<boolean> {
    try {
        const token = TokenManager.getToken();
        const currentUser = UserStore.getCurrentUser();
        const accounts = getAccounts();

        if (!currentUser || accounts[currentUser.id]) {
            showToast(accounts[currentUser?.id] ? "Current account already saved" : "Failed to get current user", undefined);
            return false;
        }

        accounts[currentUser.id] = {
            id: currentUser.id,
            username: currentUser.username,
            discriminator: currentUser.discriminator,
            avatar: currentUser.avatar,
            displayName: currentUser.globalName || currentUser.username,
            token,
            addedAt: Date.now()
        };
        addAccountToOrder(currentUser.id);

        addLog("info", "Current account added successfully", { username: currentUser.username });
        showToast(`Current account ${currentUser.username} added!`, undefined);
        return true;
    } catch (e: any) {
        addLog("error", "Failed to add current account", { error: e?.message });
        showToast("Failed to add current account", undefined);
        return false;
    }
}

export type { Account };
