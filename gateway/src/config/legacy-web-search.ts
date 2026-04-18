/** CoreBlow — Legacy Web Search Config */
export interface LegacyWebSearchConfig { enabled: boolean; provider: "google" | "bing" | "duckduckgo"; maxResults: number; }
export function migrateLegacyWebSearch(old: Record<string, unknown>): Record<string, unknown> { return { ...old, webSearch: { enabled: Boolean(old.webSearchEnabled ?? true), maxResults: Number(old.webSearchMaxResults ?? 5) } }; }
