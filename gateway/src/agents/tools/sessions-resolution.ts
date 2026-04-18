/** CoreBlow — Sessions Resolution */ export function resolveSessionFromContext(context: Record<string, unknown>): string | null { return context.sessionId as string ?? null; }
