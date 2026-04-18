/** CoreBlow — Reaction Message ID */ export function extractReactionMessageId(payload: Record<string, unknown>): string | null { return (payload.messageId as string) ?? null; }
