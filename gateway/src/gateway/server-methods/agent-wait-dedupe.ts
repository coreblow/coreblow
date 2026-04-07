export function dedupeAgentWait(
    dedupeMap: Map<string, { ts: number; ok: boolean; payload?: unknown; error?: unknown }>,
    runId: string,
    action: () => Promise<{ ok: boolean; payload?: unknown; error?: unknown }>
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
    const cached = dedupeMap.get(runId);
    if (cached) {
        if (Date.now() - cached.ts < 30000) {
            return Promise.resolve({ ok: cached.ok, payload: cached.payload, error: cached.error });
        }
        dedupeMap.delete(runId);
    }
    
    return action().then(result => {
        dedupeMap.set(runId, {
            ts: Date.now(),
            ok: result.ok,
            payload: result.payload,
            error: result.error
        });
        return result;
    });
}
