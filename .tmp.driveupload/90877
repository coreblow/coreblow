/**
 * agents/model-fallback-observation.ts
 * Observe and log model fallback events.
 */
export interface FallbackEvent { from: string; to: string; reason: string; timestamp: number; attempt: number; }
const observations: FallbackEvent[] = [];
export function recordFallback(event: Omit<FallbackEvent, 'timestamp'>): FallbackEvent { const e = { ...event, timestamp: Date.now() }; observations.push(e); return e; }
export function getFallbackHistory(): readonly FallbackEvent[] { return observations; }
export function getRecentFallbacks(n = 10): FallbackEvent[] { return observations.slice(-n); }
export function clearFallbackHistory(): void { observations.length = 0; }
export function fallbackRate(): number { return observations.length; }
