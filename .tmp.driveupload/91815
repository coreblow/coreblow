/**
 * utils/url-utils.ts
 */
export function parseQS(qs: string) { const p: Record<string, string> = {}; for (const pair of qs.replace(/^\?/, '').split('&')) { const [k, v] = pair.split('='); if (k) p[decodeURIComponent(k)] = decodeURIComponent(v || ''); } return p; }
