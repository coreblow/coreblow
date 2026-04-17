/**
 * agents/turn-engine/exclusives/observability.ts
 * Observability hooks for the turn engine — metrics, tracing, logging.
 */

export interface ObservabilityHook {
    onTurnStart?: (sessionKey: string, turnId: string) => void;
    onTurnEnd?: (sessionKey: string, turnId: string, durationMs: number) => void;
    onError?: (sessionKey: string, error: Error) => void;
    onTokenUsage?: (sessionKey: string, usage: { prompt: number; completion: number }) => void;
}

const hooks: ObservabilityHook[] = [];

export function registerObservabilityHook(hook: ObservabilityHook): () => void {
    hooks.push(hook);
    return () => {
        const idx = hooks.indexOf(hook);
        if (idx >= 0) hooks.splice(idx, 1);
    };
}

export function emitTurnStart(sessionKey: string, turnId: string): void {
    for (const h of hooks) h.onTurnStart?.(sessionKey, turnId);
}

export function emitTurnEnd(sessionKey: string, turnId: string, durationMs: number): void {
    for (const h of hooks) h.onTurnEnd?.(sessionKey, turnId, durationMs);
}

export function emitObservabilityError(sessionKey: string, error: Error): void {
    for (const h of hooks) h.onError?.(sessionKey, error);
}

export function clearObservabilityHooks(): void {
    hooks.length = 0;
}
