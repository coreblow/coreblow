/** CoreBlow — Send Dependencies */
export interface SendDeps { logger: Pick<typeof console, "info" | "warn" | "error">; fetch: typeof globalThis.fetch; }
export function createDefaultSendDeps(): SendDeps { return { logger: console, fetch: globalThis.fetch }; }
