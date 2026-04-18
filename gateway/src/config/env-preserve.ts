/** CoreBlow — Env Preserve */
const preservedKeys = new Set<string>();
export function preserveEnvKey(key: string): void { preservedKeys.add(key); }
export function isPreservedEnvKey(key: string): boolean { return preservedKeys.has(key); }
export function getPreservedEnvKeys(): string[] { return [...preservedKeys]; }
