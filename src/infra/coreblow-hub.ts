/** CoreBlow — CoreBlow Hub (Registry Client) */
export interface CoreBlowHubConfig { baseUrl: string; apiKey?: string; timeout?: number; }
export class CoreBlowHub {
  constructor(private config: CoreBlowHubConfig) {}
  async ping(): Promise<boolean> { try { const r = await fetch(`${this.config.baseUrl}/health`, { signal: AbortSignal.timeout(this.config.timeout ?? 5000) }); return r.ok; } catch { return false; } }
  async fetchPluginManifest(name: string): Promise<Record<string, unknown> | null> { try { const r = await fetch(`${this.config.baseUrl}/plugins/${encodeURIComponent(name)}/manifest`, { headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {} }); return r.ok ? await r.json() as Record<string, unknown> : null; } catch { return null; } }
  getBaseUrl(): string { return this.config.baseUrl; }
}
