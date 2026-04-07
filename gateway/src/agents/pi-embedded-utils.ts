/** PI embedded utility functions. */
export function safeJsonParse<T>(json: string, fallback: T): T { try { return JSON.parse(json) as T; } catch { return fallback; } }
export function generateRequestId(): string { return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }
