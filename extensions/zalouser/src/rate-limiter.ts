/**
 * Zalouser Rate Limiter
 */
export class ZalouserRateLimiter {
  private requests = new Map<string, number[]>();
  private maxPerMinute: number;

  constructor(maxPerMinute = 30) {
    this.maxPerMinute = maxPerMinute;
  }

  canProceed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const recent = timestamps.filter(t => now - t < 60000);
    this.requests.set(key, recent);
    return recent.length < this.maxPerMinute;
  }

  record(key: string) {
    const timestamps = this.requests.get(key) || [];
    timestamps.push(Date.now());
    this.requests.set(key, timestamps);
  }

  getRemainingQuota(key: string): number {
    const now = Date.now();
    const recent = (this.requests.get(key) || []).filter(t => now - t < 60000);
    return Math.max(0, this.maxPerMinute - recent.length);
  }
}
