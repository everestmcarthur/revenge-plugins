// Pure math, no Discord internals involved - Discord IDs are Twitter-style snowflakes: the top 42
// bits are milliseconds since the Discord epoch (2015-01-01T00:00:00.000Z).
const DISCORD_EPOCH = 1420070400000n;

export function decodeSnowflakeTimestamp(id: string): Date | null {
    const trimmed = id.trim();
    if (!/^\d{15,20}$/.test(trimmed)) return null;

    try {
        const ms = (BigInt(trimmed) >> 22n) + DISCORD_EPOCH;
        return new Date(Number(ms));
    } catch {
        return null;
    }
}
