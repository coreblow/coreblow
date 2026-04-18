/** CoreBlow — Outbound Policy */
export interface OutboundPolicy { maxMessageLength: number; rateLimit: number; rateLimitWindowMs: number; allowAttachments: boolean; }
export const DEFAULT_OUTBOUND_POLICY: OutboundPolicy = { maxMessageLength: 4000, rateLimit: 30, rateLimitWindowMs: 60000, allowAttachments: true };
