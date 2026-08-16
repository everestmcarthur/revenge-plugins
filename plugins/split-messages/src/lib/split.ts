const CODE_BLOCK_RE = /```[\s\S]*?```/g;

interface Piece {
    text: string;
    isCode: boolean;
}

function segment(content: string): Piece[] {
    const pieces: Piece[] = [];
    let lastIndex = 0;
    for (const match of content.matchAll(CODE_BLOCK_RE)) {
        const index = match.index ?? 0;
        if (index > lastIndex) pieces.push({ text: content.slice(lastIndex, index), isCode: false });
        pieces.push({ text: match[0], isCode: true });
        lastIndex = index + match[0].length;
    }
    if (lastIndex < content.length) pieces.push({ text: content.slice(lastIndex), isCode: false });
    return pieces;
}

function packByLine(lines: string[], maxLength: number, sep: string): string[] {
    const chunks: string[] = [];
    let current = "";
    for (const line of lines) {
        const candidate = current ? current + sep + line : line;
        if (candidate.length > maxLength) {
            if (current) chunks.push(current);
            current = line;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function splitText(text: string, maxLength: number, splitOnWords: boolean): string[] {
    if (!splitOnWords) {
        const chunks = packByLine(text.split("\n"), maxLength, "\n");
        if (chunks.length && !chunks.some((c) => c.length > maxLength)) return chunks;
    }
    return packByLine(text.split(" "), maxLength, " ");
}

function splitCodeBlock(block: string, maxLength: number): string[] {
    if (block.length <= maxLength) return [block];

    const fenceMatch = block.match(/^```(\S*)\n/);
    const lang = fenceMatch?.[1] ?? "";
    const innerStart = fenceMatch ? fenceMatch[0].length : 3;
    const inner = block.slice(innerStart, block.length - 3);
    const fenceOverhead = lang.length + 8;

    return packByLine(inner.split("\n"), maxLength - fenceOverhead, "\n").map(
        (c) => "```" + lang + "\n" + c + "\n```"
    );
}

export function intoChunks(content: string, maxLength: number, splitOnWords: boolean): string[] | false {
    const atoms: string[] = [];
    for (const piece of segment(content)) {
        if (!piece.text) continue;
        if (piece.isCode) atoms.push(...splitCodeBlock(piece.text, maxLength));
        else atoms.push(...splitText(piece.text, maxLength, splitOnWords));
    }
    if (atoms.some((a) => a.length > maxLength)) return false;

    const chunks: string[] = [];
    let current = "";
    for (const atom of atoms) {
        const candidate = current ? current + "\n" + atom : atom;
        if (candidate.length > maxLength) {
            if (current) chunks.push(current);
            current = atom;
        } else {
            current = candidate;
        }
    }
    if (current) chunks.push(current);

    return chunks.map((c) => c.trim()).filter(Boolean);
}
