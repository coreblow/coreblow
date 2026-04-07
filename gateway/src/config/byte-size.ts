/**
 * config/byte-size.ts
 * Human-readable byte size parsing.
 * Ported from OpenClaw src/config/byte-size.ts.
 */

const BYTE_UNITS: Record<string, number> = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    tb: 1024 * 1024 * 1024 * 1024,
    kib: 1024,
    mib: 1024 * 1024,
    gib: 1024 * 1024 * 1024,
    tib: 1024 * 1024 * 1024 * 1024,
};

/**
 * Parse a human-readable byte size string into bytes.
 * Accepts: "1.5GB", "512kb", "100mb", "1024", etc.
 */
export function parseByteSize(value: string, opts?: { defaultUnit?: string }): number {
    const trimmed = value.trim();
    if (!trimmed) throw new Error('Empty byte size string');

    const match = trimmed.match(/^([0-9]*\.?[0-9]+)\s*([a-zA-Z]*)$/);
    if (!match) throw new Error(`Invalid byte size: "${value}"`);

    const num = parseFloat(match[1]);
    if (!Number.isFinite(num) || num < 0) throw new Error(`Invalid byte size number: "${match[1]}"`);

    const unitStr = (match[2] || opts?.defaultUnit || 'b').toLowerCase();
    const multiplier = BYTE_UNITS[unitStr];
    if (multiplier === undefined) throw new Error(`Unknown byte unit: "${unitStr}"`);

    return Math.floor(num * multiplier);
}

/**
 * Parse an optional byte-size value from config.
 * Accepts non-negative numbers or strings like "2mb".
 */
export function parseNonNegativeByteSize(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const int = Math.floor(value);
        return int >= 0 ? int : null;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            const bytes = parseByteSize(trimmed);
            return bytes >= 0 ? bytes : null;
        } catch { return null; }
    }
    return null;
}

export function isValidNonNegativeByteSizeString(value: string): boolean {
    return parseNonNegativeByteSize(value) !== null;
}

/**
 * Format bytes into a human-readable string.
 */
export function formatByteSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
