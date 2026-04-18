/** CoreBlow — Dangerous Name Matching */
const DANGEROUS_PATTERNS = [/^__proto__$/i, /^constructor$/i, /^prototype$/i, /\.\./];
export function isDangerousConfigName(name: string): boolean { return DANGEROUS_PATTERNS.some((p) => p.test(name)); }
export function assertSafeConfigName(name: string): void { if (isDangerousConfigName(name)) throw new Error("Dangerous config name blocked: " + name); }
