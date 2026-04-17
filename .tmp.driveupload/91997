export function parseRestartRequestParams(params: Record<string, unknown>): { sessionKey?: string, note?: string, restartDelayMs?: number } {
    return {
        sessionKey: typeof params?.sessionKey === 'string' ? params.sessionKey.trim() || undefined : undefined,
        note: typeof params?.note === 'string' ? params.note.trim() || undefined : undefined,
        restartDelayMs: typeof params?.restartDelayMs === "number" ? Math.max(0, params.restartDelayMs) : undefined
    };
}
