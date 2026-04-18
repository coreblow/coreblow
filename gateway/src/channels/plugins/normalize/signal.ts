/** CoreBlow — Normalize Signal */ export function normalizeSignalPayload(payload: Record<string, unknown>): Record<string, unknown> { return { ...payload, normalized: true }; }
