import { React, ReactNative } from "@vendetta/metro/common";

const { View, Text } = ReactNative;

const COLORS = {
    key: "#7dd3fc",
    string: "#86efac",
    number: "#fbbf24",
    boolean: "#c4b5fd",
    null: "#9ca3af",
    punct: "#d1d5db"
};

// Matches JSON.stringify(x, null, 4) output one line at a time: leading indent, an optional
// "key": prefix, then whatever's left (a value, or a brace/bracket).
const LINE_RE = /^(\s*)("(?:[^"\\]|\\.)*"\s*:\s*)?(.*)$/;

function classify(rest: string): string {
    if (rest.startsWith('"')) return COLORS.string;
    if (/^(true|false)/.test(rest)) return COLORS.boolean;
    if (/^null/.test(rest)) return COLORS.null;
    if (/^-?\d/.test(rest)) return COLORS.number;
    return COLORS.punct;
}

export default function JsonView({ text, query }: { text: string; query: string }) {
    const lines = React.useMemo(() => text.split("\n"), [text]);
    const q = (query || "").trim().toLowerCase();

    return (
        <View>
            {lines.map((line, i) => {
                const match = line.match(LINE_RE);
                const indent = match?.[1] ?? "";
                const keyPart = match?.[2];
                const rest = match?.[3] ?? line;
                const isMatch = !!q && line.toLowerCase().includes(q);
                const dim = !!q && !isMatch;

                return (
                    <Text
                        key={i}
                        selectable
                        style={{
                            fontFamily: "monospace",
                            fontSize: 12.5,
                            lineHeight: 18,
                            opacity: dim ? 0.35 : 1,
                            backgroundColor: isMatch ? "rgba(88,101,242,0.25)" : "transparent"
                        }}
                    >
                        {indent}
                        {keyPart ? <Text style={{ color: COLORS.key }}>{keyPart}</Text> : null}
                        <Text style={{ color: classify(rest) }}>{rest}</Text>
                    </Text>
                );
            })}
        </View>
    );
}
