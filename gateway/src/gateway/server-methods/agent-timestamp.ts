export function resolveAgentTimestamp(ts: number | undefined | null): number {
    return typeof ts === 'number' && Number.isFinite(ts) ? ts : Date.now();
}
