/** CoreBlow — Explicit Session Key Normalization */
export function normalizeSessionKey(key: string): string { return key.trim().toLowerCase().replace(/\s+/g, "-"); }
