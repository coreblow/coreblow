/**
 * agents/provider-profiles/types.ts
 *
 * Type definitions untuk ProviderProfileStore.
 * CoreBlow — agents/auth-profiles/types.ts
 *
 * Adaptasi:
 * - ProviderUsageStats = port identik ProfileUsageStats (7 fields)
 * - ProviderProfileStore = simplified AuthProfileStore (tidak ada credentials)
 *   karena CoreBlow tidak manage credential — hanya track cooldown state
 * - profileId = "provider:model" pair (bukan credential profile)
 */
import type { FailoverReason } from '../failover-error.js';

/**
 * Per-provider:model usage statistics untuk cooldown tracking.
 * Port identik dari coreblow/src/agents/auth-profiles/types.ts ProfileUsageStats.
 */
export type ProviderUsageStats = {
    lastUsed?: number;
    /** Transient cooldown end timestamp (ms epoch): rate_limit, overloaded, timeout. */
    cooldownUntil?: number;
    /** Reason yang menyebabkan cooldown. */
    cooldownReason?: FailoverReason;
    /**
     * Model yang spesifik menyebabkan rate_limit.
     * Digunakan untuk model-scoped bypass: jika model lain request,
     * cooldown tidak berlaku untuk model tersebut.
     */
    cooldownModel?: string;
    /** Permanent disable end timestamp (ms epoch): billing, auth_permanent. */
    disabledUntil?: number;
    /** Reason permanent disable. */
    disabledReason?: FailoverReason;
    /** Accumulated error count dalam failure window. */
    errorCount?: number;
    /** Per-reason failure counts untuk resolveProvidersUnavailableReason scoring. */
    failureCounts?: Partial<Record<FailoverReason, number>>;
    /** Timestamp failure terakhir (untuk failure window reset). */
    lastFailureAt?: number;
};

/**
 * Root store yang di-persist ke provider-profiles.json.
 * CoreBlow — agents/auth-profiles/types.ts AuthProfileStore
 * tanpa credentials (CoreBlow tidak manage API keys/OAuth).
 */
export type ProviderProfileStore = {
    version: number;
    /** Key = "provider:model" (e.g. "openai:gpt-4", "anthropic:claude-3") */
    usageStats: Record<string, ProviderUsageStats>;
    lastSavedAt?: number;
};

/**
 * Configurable backoff parameters per gateway instance.
 * Dapat di-override via config jik diperlukan.
 */
export type CooldownConfig = {
    /** Billing backoff base (default: 5 jam). */
    billingBackoffMs: number;
    /** Billing backoff max cap (default: 24 jam). */
    billingMaxMs: number;
    /** Failure window sebelum error counter di-reset (default: 24 jam). */
    failureWindowMs: number;
};
