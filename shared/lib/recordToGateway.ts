export function authorToGateway(a: any): any {
    if (!a || typeof a !== "object") return a;
    return {
        id: a.id,
        username: a.username,
        discriminator: a.discriminator && a.discriminator !== "???" ? String(a.discriminator) : "0",
        avatar: a.avatar ?? null,
        avatar_decoration_data: a.avatarDecorationData ?? a.avatar_decoration_data ?? null,
        bot: Boolean(a.bot),
        global_name: a.globalName ?? a.global_name ?? a.username,
    };
}

export function embedToGateway(e: any): any {
    if (!e || typeof e !== "object") return e;
    return {
        ...e,
        title: e.rawTitle ?? e.title,
        description: e.rawDescription ?? e.description,
        fields: Array.isArray(e.fields)
            ? e.fields.map((f: any) => ({
                  name: f.rawName ?? f.name ?? "",
                  value: f.rawValue ?? f.value ?? "",
                  inline: Boolean(f.inline),
              }))
            : undefined,
        author: e.author
            ? {
                  name: e.author.name,
                  url: e.author.url,
                  icon_url: e.author.iconURL ?? e.author.icon_url,
                  proxy_icon_url: e.author.iconProxyURL ?? e.author.proxy_icon_url,
              }
            : undefined,
        footer: e.footer
            ? {
                  text: e.footer.text,
                  icon_url: e.footer.iconURL ?? e.footer.icon_url,
                  proxy_icon_url: e.footer.iconProxyURL ?? e.footer.proxy_icon_url,
              }
            : undefined,
        image: e.image
            ? {
                  url: e.image.url,
                  proxy_url: e.image.proxyURL ?? e.image.proxy_url,
                  width: e.image.width,
                  height: e.image.height,
              }
            : undefined,
        thumbnail: e.thumbnail
            ? {
                  url: e.thumbnail.url,
                  proxy_url: e.thumbnail.proxyURL ?? e.thumbnail.proxy_url,
                  width: e.thumbnail.width,
                  height: e.thumbnail.height,
              }
            : undefined,
    };
}

export function componentToGateway(c: any): any {
    if (!c || typeof c !== "object") return c;
    const copy = { ...c };
    if (copy.type === 3 || copy.type === "3") {
        copy.custom_id = copy.customId ?? copy.custom_id ?? copy.id ?? "select";
        copy.min_values = copy.minValues ?? copy.min_values ?? 1;
        copy.max_values = copy.maxValues ?? copy.max_values ?? 1;
    } else if (copy.type === 2 || copy.type === "2") {
        copy.custom_id = copy.customId ?? copy.custom_id ?? copy.id ?? "button";
    }
    if (Array.isArray(copy.components)) {
        copy.components = copy.components.map(componentToGateway);
    }
    return copy;
}

export function recordToGateway(record: any): any {
    if (!record || typeof record !== "object") return record;
    return {
        ...record,
        author: authorToGateway(record.author),
        embeds: Array.isArray(record.embeds) ? record.embeds.map(embedToGateway) : record.embeds,
        components: Array.isArray(record.components) ? record.components.map(componentToGateway) : record.components,
    };
}
