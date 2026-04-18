/**
 * agents/stable-stringify.ts
 * Deterministic JSON serialization for cache keys / comparison.
 * Ported from CoreBlow src/agents/stable-stringify.ts.
 */
export function stableStringify(value: unknown): string {
    if (value === null || value === undefined) return JSON.stringify(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
    return `{${pairs.join(',')}}`;
}
export function stableHash(value: unknown): string {
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);
}
