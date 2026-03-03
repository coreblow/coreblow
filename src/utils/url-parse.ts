/**
 * utils/url-parse.ts
 */
export function isUrl(s: string) { try { new URL(s); return true; } catch { return false; } }
