/** Subagent registry query utilities. */
export function filterByStatus<T extends { status: string }>(entries: T[], status: string): T[] { return entries.filter((e) => e.status === status); }
export function sortByTimestamp<T extends { timestamp?: number }>(entries: T[]): T[] { return [...entries].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)); }
