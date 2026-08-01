const MULTIPLIERS: Record<string, number> = {
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
    h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
    d: 86400000, day: 86400000, days: 86400000,
    w: 604800000, week: 604800000, weeks: 604800000
};

/** Parses inputs like "10m", "2 h", "1day" into a millisecond delay. Returns undefined if unparseable. */
export function parseDuration(input: string): number | undefined {
    const match = input.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
    if (!match) return undefined;

    const amount = Number(match[1]);
    const multiplier = MULTIPLIERS[match[2]];
    if (!multiplier || !Number.isFinite(amount) || amount <= 0) return undefined;

    return Math.round(amount * multiplier);
}
