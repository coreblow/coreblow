/** CoreBlow — Dedupe Utility */
export function dedupeStrings(items: string[]): string[] { return [...new Set(items)]; }
export function dedupeById<T extends { id: string }>(items: T[]): T[] { const seen = new Set<string>(); return items.filter((i) => { if (seen.has(i.id)) return false; seen.add(i.id); return true; }); }
export function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] { const seen = new Set<string>(); return items.filter((i) => { const k = keyFn(i); if (seen.has(k)) return false; seen.add(k); return true; }); }
