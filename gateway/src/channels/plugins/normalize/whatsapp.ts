/** CoreBlow — Normalize WhatsApp */ export function normalizeWhatsAppPayload(payload: Record<string, unknown>): Record<string, unknown> { return { ...payload, normalized: true }; }
