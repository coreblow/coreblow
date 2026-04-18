/** CoreBlow — Fixed Window Rate Limiter */
export class FixedWindowRateLimiter {
  private windows = new Map<string, { count: number; start: number }>();
  constructor(private maxRequests: number, private windowMs: number) {}
  tryAcquire(key: string): boolean {
    const now = Date.now(); const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) { this.windows.set(key, { count: 1, start: now }); return true; }
    if (w.count >= this.maxRequests) return false;
    w.count++; return true;
  }
  reset(key: string): void { this.windows.delete(key); }
  resetAll(): void { this.windows.clear(); }
}
