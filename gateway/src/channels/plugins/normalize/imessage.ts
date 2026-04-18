/** CoreBlow — Normalize iMessage */ export function normalizeIMessagePayload(payload: Record<string, unknown>): Record<string, unknown> { return { ...payload, normalized: true }; }
