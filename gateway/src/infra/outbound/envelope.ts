/** CoreBlow — Message Envelope */
export interface Envelope { id: string; sessionId: string; channelId: string; timestamp: number; payload: unknown; metadata?: Record<string, unknown>; }
export function createEnvelope(sessionId: string, channelId: string, payload: unknown): Envelope { return { id: crypto.randomUUID(), sessionId, channelId, timestamp: Date.now(), payload }; }
