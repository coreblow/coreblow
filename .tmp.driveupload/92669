export interface Envelope { id: string; channelId: string; content: string; createdAt: number; expiresAt?: number; }
export function createEnvelope(channelId: string, content: string, ttlMs = 300000): Envelope { return { id: `env_${Date.now()}`, channelId, content, createdAt: Date.now(), expiresAt: Date.now() + ttlMs }; }
export function isEnvelopeExpired(env: Envelope): boolean { return env.expiresAt ? Date.now() > env.expiresAt : false; }
