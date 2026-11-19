/**
 * CoreBlow — Multi-Key Credential Pool, Auto-Failover & Live Usage Telemetry
 *
 * Implements:
 * 1. Multi-key pool per provider (Anthropic, OpenAI, Gemini, Groq, DeepSeek, OpenRouter, Custom, Ollama)
 * 2. Exponential cooldown rotation on 429/502/503/529
 * 3. Daybreak Fallback Chain when provider pool is exhausted
 * 4. Token & cost telemetry per provider/key with deterministic pricing
 * 5. Masked-on-read API keys (sk-...xxxx) and atomic persistence
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveHomeStateDir } from "../memory/cory.js";

// ─── Types & Contracts ───────────────────────────────────────────────────────

export type SupportedProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "groq"
  | "deepseek"
  | "openrouter"
  | "custom"
  | "ollama";

export interface PooledCredential {
  readonly id: string;
  readonly providerId: SupportedProviderId | string;
  readonly label: string;
  readonly apiKey: string;
  priority: number; // lower number = preferred / higher priority (1 before 2)
  enabled: boolean;
  cooldownUntilMs?: number;
  errorCount: number;
  lastUsedAtMs?: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAtMs: number;
}

export type MaskedPooledCredential = Omit<PooledCredential, "apiKey"> & {
  readonly apiKey: string; // masked form: e.g. sk-...xxxx
};

export interface CredentialOutcomeReport {
  ok: boolean;
  statusCode?: number;
  retryAfterMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  errorMessage?: string;
}

export interface CredentialSelectionResult {
  readonly credential: PooledCredential;
  readonly providerId: string;
  readonly fallbackSwitched: boolean;
  readonly originalProviderId?: string;
  readonly reason?: string;
}

export interface ProviderUsageTelemetry {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  failovers: number;
}

export interface CredentialPoolStoreFile {
  version: 1;
  updatedAtMs: number;
  fallbackChain: string[];
  pools: Record<string, PooledCredential[]>; // key: providerId
  telemetry: {
    daily: Record<string, ProviderUsageTelemetry>; // YYYY-MM-DD
    monthly: Record<string, ProviderUsageTelemetry>; // YYYY-MM
    lifetime: ProviderUsageTelemetry;
    byProvider: Record<string, ProviderUsageTelemetry>;
  };
}

// ─── Pricing Matrix (USD per 1,000,000 tokens) ──────────────────────────────

export const PROVIDER_TOKEN_PRICING: Readonly<
  Record<string, { inputPerMillionUsd: number; outputPerMillionUsd: number }>
> = Object.freeze({
  anthropic: { inputPerMillionUsd: 3.0, outputPerMillionUsd: 15.0 }, // Claude 3.7 Sonnet baseline
  openai: { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10.0 }, // GPT-4o baseline
  gemini: { inputPerMillionUsd: 0.1, outputPerMillionUsd: 0.4 }, // Gemini 2.0 Flash baseline
  groq: { inputPerMillionUsd: 0.59, outputPerMillionUsd: 0.79 }, // Llama 3.3 70B baseline
  deepseek: { inputPerMillionUsd: 0.14, outputPerMillionUsd: 0.28 }, // DeepSeek-V3 / Chat baseline
  openrouter: { inputPerMillionUsd: 1.0, outputPerMillionUsd: 3.0 },
  custom: { inputPerMillionUsd: 1.0, outputPerMillionUsd: 2.0 },
  ollama: { inputPerMillionUsd: 0.0, outputPerMillionUsd: 0.0 }, // Local free
});

export const DEFAULT_FALLBACK_CHAIN: readonly string[] = Object.freeze([
  "anthropic",
  "openai",
  "gemini",
  "groq",
  "deepseek",
  "ollama",
]);

const COOLDOWN_TIERS_MS = [30_000, 60_000, 180_000, 300_000] as const;

// ─── Key Masking Helper ─────────────────────────────────────────────────────

export function maskApiKey(apiKey: string): string {
  const trimmed = (apiKey || "").trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return "••••••••";

  let prefix = "";
  if (trimmed.startsWith("sk-ant-")) {
    prefix = "sk-ant-";
  } else if (trimmed.startsWith("sk-proj-")) {
    prefix = "sk-proj";
  } else if (trimmed.startsWith("gsk_")) {
    prefix = "gsk_";
  } else if (trimmed.startsWith("sk-")) {
    prefix = "sk-";
  } else {
    prefix = trimmed.slice(0, 3);
  }
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

// ─── CredentialPoolManager Implementation ───────────────────────────────────

export class CredentialPoolManager {
  private readonly stateDir: string;
  private readonly storePath: string;
  private store: CredentialPoolStoreFile;
  private roundRobinCursors = new Map<string, number>();

  constructor(baseDir?: string) {
    this.stateDir = baseDir ? resolveHomeStateDir(baseDir) : resolveHomeStateDir();
    const providersDir = path.join(this.stateDir, "providers");
    this.storePath = path.join(providersDir, "credential-pools.json");
    this.store = this.loadStore();
  }

  private loadStore(): CredentialPoolStoreFile {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.version === 1) {
          return parsed as CredentialPoolStoreFile;
        }
      }
    } catch {}

    return {
      version: 1,
      updatedAtMs: Date.now(),
      fallbackChain: [...DEFAULT_FALLBACK_CHAIN],
      pools: {},
      telemetry: {
        daily: {},
        monthly: {},
        lifetime: { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, failovers: 0 },
        byProvider: {},
      },
    };
  }

  private saveStoreAtomic(): void {
    try {
      const dir = path.dirname(this.storePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }
      this.store.updatedAtMs = Date.now();
      const tmpPath = `${this.storePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 6)}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.store, null, 2), "utf8");
      fs.renameSync(tmpPath, this.storePath);
    } catch {}
  }

  // ─── Pool Management ──────────────────────────────────────────────────────

  public addCredential(params: {
    providerId: SupportedProviderId | string;
    apiKey: string;
    label?: string;
    priority?: number;
  }): PooledCredential {
    const provider = params.providerId.toLowerCase().trim();
    const key = params.apiKey.trim();
    if (!key) {
      throw new Error("apiKey cannot be empty");
    }

    const pool = this.store.pools[provider] ?? [];
    // Check if key already exists in pool
    const existing = pool.find((k) => k.apiKey === key);
    if (existing) {
      existing.priority = params.priority ?? existing.priority;
      existing.enabled = true;
      existing.cooldownUntilMs = undefined;
      existing.errorCount = 0;
      this.saveStoreAtomic();
      return existing;
    }

    const id = `key_${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cred: PooledCredential = {
      id,
      providerId: provider,
      label: params.label?.trim() || `${provider.toUpperCase()} Key #${pool.length + 1}`,
      apiKey: key,
      priority: params.priority ?? pool.length + 1,
      enabled: true,
      errorCount: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      createdAtMs: Date.now(),
    };

    pool.push(cred);
    this.store.pools[provider] = pool;
    this.saveStoreAtomic();
    return cred;
  }

  public removeCredential(keyId: string): boolean {
    for (const [provider, pool] of Object.entries(this.store.pools)) {
      const idx = pool.findIndex((k) => k.id === keyId);
      if (idx !== -1) {
        pool.splice(idx, 1);
        if (pool.length === 0) {
          delete this.store.pools[provider];
        } else {
          this.store.pools[provider] = pool;
        }
        this.saveStoreAtomic();
        return true;
      }
    }
    return false;
  }

  public setCredentialEnabled(keyId: string, enabled: boolean): boolean {
    for (const pool of Object.values(this.store.pools)) {
      const cred = pool.find((k) => k.id === keyId);
      if (cred) {
        cred.enabled = enabled;
        this.saveStoreAtomic();
        return true;
      }
    }
    return false;
  }

  public getFallbackChain(): string[] {
    return [...this.store.fallbackChain];
  }

  public setFallbackChain(chain: string[]): string[] {
    this.store.fallbackChain = chain
      .map((p) => p.toLowerCase().trim())
      .filter((p, i, arr) => p.length > 0 && arr.indexOf(p) === i);
    this.saveStoreAtomic();
    return this.getFallbackChain();
  }

  public getMaskedPools(): {
    fallbackChain: string[];
    pools: Record<string, MaskedPooledCredential[]>;
    telemetry: CredentialPoolStoreFile["telemetry"];
  } {
    const masked: Record<string, MaskedPooledCredential[]> = {};
    for (const [prov, keys] of Object.entries(this.store.pools)) {
      masked[prov] = keys.map((k) => ({
        ...k,
        apiKey: maskApiKey(k.apiKey),
      }));
    }
    return {
      fallbackChain: this.getFallbackChain(),
      pools: masked,
      telemetry: this.store.telemetry,
    };
  }

  // ─── Credential Selection & Cooldown Rotation ─────────────────────────────

  /**
   * Selects the highest-priority enabled credential for a provider that is not in cooldown.
   * If all keys for the provider are in cooldown or none exist, executes Daybreak Failover
   * across the fallback chain.
   */
  public selectCredential(targetProviderId: string): CredentialSelectionResult | null {
    const primary = targetProviderId.toLowerCase().trim();
    const now = Date.now();

    // 1. Try primary provider pool
    const primaryResult = this.pickHealthyKeyFromPool(primary, now);
    if (primaryResult) {
      primaryResult.lastUsedAtMs = now;
      this.saveStoreAtomic();
      return {
        credential: primaryResult,
        providerId: primary,
        fallbackSwitched: false,
      };
    }

    // 2. Daybreak Fallback Chain
    const chain = this.store.fallbackChain;
    const startIdx = chain.indexOf(primary);
    const candidateProviders = startIdx !== -1
      ? [...chain.slice(startIdx + 1), ...chain.slice(0, startIdx)]
      : chain;

    for (const fallbackProv of candidateProviders) {
      if (fallbackProv === primary) continue;
      const fallbackKey = this.pickHealthyKeyFromPool(fallbackProv, now);
      if (fallbackKey) {
        fallbackKey.lastUsedAtMs = now;
        this.recordFailoverEvent(primary, fallbackProv);
        this.saveStoreAtomic();
        return {
          credential: fallbackKey,
          providerId: fallbackProv,
          fallbackSwitched: true,
          originalProviderId: primary,
          reason: `Primary provider '${primary}' pool exhausted or in cooldown. Rotated to fallback provider '${fallbackProv}'.`,
        };
      }
    }

    return null;
  }

  private pickHealthyKeyFromPool(providerId: string, now: number): PooledCredential | null {
    const pool = this.store.pools[providerId] ?? [];
    const healthy = pool.filter(
      (k) => k.enabled && (!k.cooldownUntilMs || k.cooldownUntilMs <= now),
    );

    if (healthy.length === 0) {
      return null;
    }

    // Sort by priority ascending (1 before 2)
    healthy.sort((a, b) => a.priority - b.priority);
    const topPriority = healthy[0].priority;
    const bestCandidates = healthy.filter((k) => k.priority === topPriority);

    if (bestCandidates.length === 1) {
      return bestCandidates[0];
    }

    // Round-robin on tie
    const cursor = (this.roundRobinCursors.get(providerId) ?? 0) % bestCandidates.length;
    this.roundRobinCursors.set(providerId, cursor + 1);
    return bestCandidates[cursor];
  }

  /**
   * Reports the outcome of an API call using a credential.
   * On 429, 502, 503, 529: sets exponential cooldown and increments errorCount.
   * On 200: resets errorCount and updates token & cost telemetry.
   */
  public reportCredentialOutcome(
    keyId: string,
    outcome: CredentialOutcomeReport,
  ): {
    placedInCooldown: boolean;
    cooldownMs?: number;
    estimatedCostUsd?: number;
  } {
    let targetCred: PooledCredential | undefined;
    for (const pool of Object.values(this.store.pools)) {
      targetCred = pool.find((k) => k.id === keyId);
      if (targetCred) break;
    }

    if (!targetCred) {
      return { placedInCooldown: false };
    }

    const now = Date.now();
    const isRateLimited = outcome.statusCode === 429;
    const isTransientError =
      outcome.statusCode === 502 ||
      outcome.statusCode === 503 ||
      outcome.statusCode === 529 ||
      Boolean(outcome.errorMessage?.includes("overloaded") || outcome.errorMessage?.includes("rate limit"));

    if (isRateLimited || isTransientError) {
      targetCred.errorCount += 1;
      const tierIdx = Math.min(targetCred.errorCount - 1, COOLDOWN_TIERS_MS.length - 1);
      const cooldownMs = outcome.retryAfterMs ?? COOLDOWN_TIERS_MS[tierIdx];
      targetCred.cooldownUntilMs = now + cooldownMs;
      this.saveStoreAtomic();
      return { placedInCooldown: true, cooldownMs };
    }

    if (outcome.ok) {
      targetCred.errorCount = 0;
      targetCred.cooldownUntilMs = undefined;

      const inTokens = outcome.inputTokens ?? 0;
      const outTokens = outcome.outputTokens ?? 0;
      const totalTokens = inTokens + outTokens;

      const pricing = PROVIDER_TOKEN_PRICING[targetCred.providerId] ?? PROVIDER_TOKEN_PRICING.custom;
      const cost =
        (inTokens / 1_000_000) * pricing.inputPerMillionUsd +
        (outTokens / 1_000_000) * pricing.outputPerMillionUsd;

      targetCred.inputTokens += inTokens;
      targetCred.outputTokens += outTokens;
      targetCred.totalTokens += totalTokens;
      targetCred.estimatedCostUsd += cost;

      // Update rolling telemetry
      this.updateTelemetry(targetCred.providerId, inTokens, outTokens, cost);
      this.saveStoreAtomic();
      return { placedInCooldown: false, estimatedCostUsd: cost };
    }

    return { placedInCooldown: false };
  }

  // ─── Telemetry Accounting ─────────────────────────────────────────────────

  private updateTelemetry(
    providerId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
  ): void {
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthKey = now.toISOString().slice(0, 7); // YYYY-MM
    const totalTokens = inputTokens + outputTokens;

    const apply = (rec: ProviderUsageTelemetry) => {
      rec.requests += 1;
      rec.inputTokens += inputTokens;
      rec.outputTokens += outputTokens;
      rec.totalTokens += totalTokens;
      rec.estimatedCostUsd += costUsd;
    };

    // Lifetime
    apply(this.store.telemetry.lifetime);

    // Daily
    if (!this.store.telemetry.daily[dayKey]) {
      this.store.telemetry.daily[dayKey] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        failovers: 0,
      };
    }
    apply(this.store.telemetry.daily[dayKey]);

    // Monthly
    if (!this.store.telemetry.monthly[monthKey]) {
      this.store.telemetry.monthly[monthKey] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        failovers: 0,
      };
    }
    apply(this.store.telemetry.monthly[monthKey]);

    // By Provider
    if (!this.store.telemetry.byProvider[providerId]) {
      this.store.telemetry.byProvider[providerId] = {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        failovers: 0,
      };
    }
    apply(this.store.telemetry.byProvider[providerId]);
  }

  private recordFailoverEvent(fromProvider: string, toProvider: string): void {
    const dayKey = new Date().toISOString().slice(0, 10);
    this.store.telemetry.lifetime.failovers += 1;
    if (this.store.telemetry.daily[dayKey]) {
      this.store.telemetry.daily[dayKey].failovers += 1;
    }
    if (this.store.telemetry.byProvider[fromProvider]) {
      this.store.telemetry.byProvider[fromProvider].failovers += 1;
    }
  }
}

// ─── Global Singleton ───────────────────────────────────────────────────────

let globalCredentialPoolManager: CredentialPoolManager | null = null;

export function getGlobalCredentialPoolManager(baseDir?: string): CredentialPoolManager {
  if (!globalCredentialPoolManager || (baseDir && globalCredentialPoolManager["stateDir"] !== baseDir)) {
    globalCredentialPoolManager = new CredentialPoolManager(baseDir);
  }
  return globalCredentialPoolManager;
}
