/** PI auth JSON serialization. */
export function serializeAuth(data: Record<string, unknown>): string { return JSON.stringify(data, null, 2); }
export function deserializeAuth(json: string): Record<string, unknown> | null { try { return JSON.parse(json); } catch { return null; } }
