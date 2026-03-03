/**
 * sessions/rate-limit.ts
 */
export class SessionRateLimit { private counts = new Map<string, {count: number; resetAt: number}>(); check(sessionId: string, max = 100, windowMs = 60000): boolean { const now = Date.now(); const entry = this.counts.get(sessionId); if (!entry || now > entry.resetAt) { this.counts.set(sessionId, {count: 1, resetAt: now + windowMs}); return true; } entry.count++; return entry.count <= max; } }
