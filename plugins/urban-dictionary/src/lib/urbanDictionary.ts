import { safeFetch } from "@vendetta/utils";

export interface UrbanDefinition {
    word: string;
    definition: string;
    example: string;
    thumbsUp: number;
    thumbsDown: number;
}

function clean(text: string): string {
    return (text ?? "").replace(/[[\]]/g, "").trim();
}

export async function fetchDefinition(term: string): Promise<UrbanDefinition | undefined> {
    const res = await safeFetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(term)}`);
    const data = await res.json();
    const top = data?.list?.[0];
    if (!top) return undefined;

    return {
        word: top.word,
        definition: clean(top.definition).slice(0, 800),
        example: clean(top.example).slice(0, 400),
        thumbsUp: top.thumbs_up ?? 0,
        thumbsDown: top.thumbs_down ?? 0
    };
}
