/** CoreBlow — Normalize Slack */ export function normalizeSlackPayload(payload: Record<string, unknown>): Record<string, unknown> { return { ...payload, normalized: true }; }
