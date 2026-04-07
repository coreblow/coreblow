/** Model allowlist reference. */
export function isModelAllowed(modelId: string, allowlist?: string[]): boolean { return !allowlist || allowlist.length === 0 || allowlist.includes(modelId); }
export function isModelBlocked(modelId: string, blocklist?: string[]): boolean { return !!blocklist && blocklist.includes(modelId); }
