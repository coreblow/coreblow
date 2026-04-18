/**
 * CoreBlow — Bonjour/mDNS Discovery
 */
export interface BonjourService { name: string; type: string; port: number; host: string; addresses: string[]; txt?: Record<string, string>; }
export class BonjourDiscovery {
  private services = new Map<string, BonjourService>();
  register(svc: BonjourService): void { this.services.set(`${svc.name}:${svc.port}`, svc); }
  unregister(name: string): void { for (const [k, v] of this.services) { if (v.name === name) this.services.delete(k); } }
  find(type: string): BonjourService[] { return [...this.services.values()].filter((s) => s.type === type); }
  getAll(): BonjourService[] { return [...this.services.values()]; }
  clear(): void { this.services.clear(); }
}
export class BonjourError extends Error { constructor(msg: string) { super(msg); this.name = 'BonjourError'; } }
