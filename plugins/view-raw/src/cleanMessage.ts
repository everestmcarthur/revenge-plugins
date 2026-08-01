// Forked from bwlok/revenge-plugins (plugins/ViewRaw), GPLv3. Original authors: sapphire, Vendicated, Bwlok.
export function cleanMessage(msg: any) {
    const clone = JSON.parse(JSON.stringify(msg));
    for (const key in clone.author) {
        switch (key) {
            case "email":
            case "phone":
            case "mfaEnabled":
            case "hasBouncedEmail":
                delete clone.author[key];
        }
    }

    return clone;
}
