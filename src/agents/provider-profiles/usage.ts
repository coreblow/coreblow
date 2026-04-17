/**
 * agents/provider-profiles/usage.ts
 *
 * Cooldown lifecycle — port identik dari:
 * coreblow/src/agents/auth-profiles/usage.ts
 *
 * Semua fungsi diport 1:1 dengan adaptasi naming:
 * - AuthProfileStore → ProviderProfileStore
 * - profileId = credential profile → profileId = "provider:model"
 * - CoreBlowConfig → CooldownConfig (lokal, lebih sederhana)
 * - normalizeProviderId → plain string (tidak perlu normalisasi)
 * - logAuthProfileFailureStateChange → logProviderFailureStateChange (state-observation)
 *
 * @see coreblow/src/agents/auth-profiles/usage.ts
 */
import { log } from './constants.js';
import { saveProviderProfileStore, updateProviderProfileStoreWithLock } from './store.js';
import type {
    CooldownConfig,
    ProviderProfileStore,
    ProviderUsageStats,
} from './types.js';
import type { FailoverReason } from '../failover-error.js';

// ─── Dependency injection (testable, port CoreBlow pattern) ──────────────────

const usageDeps = {
    saveProviderProfileStore,
    updateProviderProfileStoreWithLock,
};

export const __testing = {
    setDepsForTest(
        overrides: Partial<{
            saveProviderProfileStore: typeof saveProviderProfileStore;
            updateProviderProfileStoreWithLock: typeof updateProviderProfileStoreWithLock;
        }> | null,
    ) {
        usageDeps.saveProviderProfileStore = overrides?.saveProviderProfileStore ?? saveProviderProfileStore;
        usageDeps.updateProviderProfileStoreWithLock = overrides?.updateProviderProfileStoreWithLock ?? updateProviderProfileStoreWithLock;
    },
};

// ─── Failure reason priority (port CoreBlow FAILURE_REASON_PRIORITY) ──────────

const FAILURE_REASON_PRIORITY: FailoverReason[] = [
    'auth_permanent',
    'auth',
    'session_expired',  // permanent—no retry value, treated like auth
    'billing',
    'format',
    'model_not_found',
    'overloaded',
    'timeout',
    'rate_limit',
    'unknown',
];

const FAILURE_REASON_SET = new Set<FailoverReason>(FAILURE_REASON_PRIORITY);
const FAILURE_REASON_ORDER = new Map<FailoverReason, number>(
    FAILURE_REASON_PRIORITY.map((reason, index) => [reason, index]),
);

// ─── Default CooldownConfig ───────────────────────────────────────────────────

const DEFAULT_COOLDOWN_CONFIG: CooldownConfig = {
    billingBackoffMs: 5 * 60 * 60 * 1000,   // 5 hours
    billingMaxMs: 24 * 60 * 60 * 1000,        // 24 hours
    failureWindowMs: 24 * 60 * 60 * 1000,     // 24 hours
};

// ─── Helper: resolve unusable window ─────────────────────────────────────────
// Port identik dari CoreBlow resolveProfileUnusableUntil()

export function resolveProviderUnusableUntil(
    stats: Pick<ProviderUsageStats, 'cooldownUntil' | 'disabledUntil'>,
): number | null {
    const values = [stats.cooldownUntil, stats.disabledUntil]
        .filter((v): v is number => typeof v === 'number')
        .filter((v) => Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;
    return Math.max(...values);
}

function isActiveUnusableWindow(until: number | undefined, now: number): boolean {
    return typeof until === 'number' && Number.isFinite(until) && until > 0 && now < until;
}

// ─── Model-scoped bypass (port CoreBlow shouldBypassModelScopedCooldown) ─────

function shouldBypassModelScopedCooldown(
    stats: Pick<ProviderUsageStats, 'cooldownReason' | 'cooldownModel' | 'disabledUntil'>,
    now: number,
    forModel?: string,
): boolean {
    return !!(
        forModel &&
        stats.cooldownReason === 'rate_limit' &&
        stats.cooldownModel &&
        stats.cooldownModel !== forModel &&
        !isActiveUnusableWindow(stats.disabledUntil, now)
    );
}

// ─── isProviderInCooldown (port CoreBlow isProfileInCooldown) ────────────────

/**
 * Check apakah provider:model pair sedang dalam cooldown.
 *
 * Model-scoped bypass: jika cooldown disebabkan rate_limit pada model tertentu,
 * request untuk model LAIN tetap diizinkan (profile-wide billing/auth tetap blocked).
 *
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts isProfileInCooldown()
 */
export function isProviderInCooldown(
    store: ProviderProfileStore,
    profileId: string,
    options?: { now?: number; forModel?: string },
): boolean {
    const stats = store.usageStats[profileId];
    if (!stats) return false;
    const ts = options?.now ?? Date.now();
    if (shouldBypassModelScopedCooldown(stats, ts, options?.forModel)) return false;
    const unusableUntil = resolveProviderUnusableUntil(stats);
    return unusableUntil ? ts < unusableUntil : false;
}

// ─── getSoonestCooldownExpiry (port from OC) ─────────────────────────────────

/**
 * Return earliest cooldown expiry timestamp (ms epoch) di antara profileIds.
 * Return null jika tidak ada cooldown aktif.
 *
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts getSoonestCooldownExpiry()
 */
export function getSoonestCooldownExpiry(
    store: ProviderProfileStore,
    profileIds: string[],
    options?: { now?: number; forModel?: string },
): number | null {
    const ts = options?.now ?? Date.now();
    let soonest: number | null = null;
    for (const id of profileIds) {
        const stats = store.usageStats[id];
        if (!stats) continue;
        if (shouldBypassModelScopedCooldown(stats, ts, options?.forModel)) continue;
        const until = resolveProviderUnusableUntil(stats);
        if (typeof until !== 'number' || !Number.isFinite(until) || until <= 0) continue;
        if (soonest === null || until < soonest) soonest = until;
    }
    return soonest;
}

// ─── resolveProvidersUnavailableReason (port from OC) ───────────────────────

/**
 * Infer the most likely reason all candidate profiles are unavailable.
 * Menggunakan weighted scoring — explicit disabledReason weights lebih tinggi.
 *
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts resolveProfilesUnavailableReason()
 */
export function resolveProvidersUnavailableReason(params: {
    store: ProviderProfileStore;
    profileIds: string[];
    now?: number;
}): FailoverReason | null {
    const now = params.now ?? Date.now();
    const scores = new Map<FailoverReason, number>();
    const addScore = (reason: FailoverReason, value: number) => {
        if (!FAILURE_REASON_SET.has(reason) || value <= 0 || !Number.isFinite(value)) return;
        scores.set(reason, (scores.get(reason) ?? 0) + value);
    };

    for (const profileId of params.profileIds) {
        const stats = params.store.usageStats[profileId];
        if (!stats) continue;

        const disabledActive = isActiveUnusableWindow(stats.disabledUntil, now);
        if (disabledActive && stats.disabledReason && FAILURE_REASON_SET.has(stats.disabledReason)) {
            // Disabled reason = high-signal; weight heavily (port CoreBlow 1_000)
            addScore(stats.disabledReason, 1_000);
            continue;
        }

        const cooldownActive = isActiveUnusableWindow(stats.cooldownUntil, now);
        if (!cooldownActive) continue;

        let recordedReason = false;
        for (const [rawReason, rawCount] of Object.entries(stats.failureCounts ?? {})) {
            const reason = rawReason as FailoverReason;
            const count = typeof rawCount === 'number' ? rawCount : 0;
            if (!FAILURE_REASON_SET.has(reason) || count <= 0) continue;
            addScore(reason, count);
            recordedReason = true;
        }
        if (!recordedReason) {
            // Port: unknown 1 — not rate_limit (avoids false "rate limit reached")
            addScore('unknown', 1);
        }
    }

    if (scores.size === 0) return null;

    let best: FailoverReason | null = null;
    let bestScore = -1;
    let bestPriority = Number.MAX_SAFE_INTEGER;
    for (const reason of FAILURE_REASON_PRIORITY) {
        const score = scores.get(reason);
        if (typeof score !== 'number') continue;
        const priority = FAILURE_REASON_ORDER.get(reason) ?? Number.MAX_SAFE_INTEGER;
        if (score > bestScore || (score === bestScore && priority < bestPriority)) {
            best = reason;
            bestScore = score;
            bestPriority = priority;
        }
    }
    return best;
}

// ─── Backoff calculation (port CoreBlow exact) ────────────────────────────────

/**
 * Stepped cooldown backoff: 30s → 60s → 5 minutes (capped).
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts calculateAuthProfileCooldownMs()
 */
export function calculateProviderCooldownMs(errorCount: number): number {
    const normalized = Math.max(1, errorCount);
    if (normalized <= 1) return 30_000;    // 30 seconds
    if (normalized <= 2) return 60_000;    // 1 minute
    return 5 * 60_000;                      // 5 minutes max
}

function calculateBillingDisableMsWithConfig(params: {
    errorCount: number;
    baseMs: number;
    maxMs: number;
}): number {
    const normalized = Math.max(1, params.errorCount);
    const baseMs = Math.max(60_000, params.baseMs);
    const maxMs = Math.max(baseMs, params.maxMs);
    const exponent = Math.min(normalized - 1, 10);
    const raw = baseMs * 2 ** exponent;
    return Math.min(maxMs, raw);
}

// ─── Internal: update stats entry ─────────────────────────────────────────────

function updateUsageStatsEntry(
    store: ProviderProfileStore,
    profileId: string,
    updater: (existing: ProviderUsageStats | undefined) => ProviderUsageStats,
): void {
    store.usageStats = store.usageStats ?? {};
    store.usageStats[profileId] = updater(store.usageStats[profileId]);
}

function keepActiveWindowOrRecompute(params: {
    existingUntil: number | undefined;
    now: number;
    recomputedUntil: number;
}): number {
    const { existingUntil, now, recomputedUntil } = params;
    const hasActiveWindow =
        typeof existingUntil === 'number' &&
        Number.isFinite(existingUntil) &&
        existingUntil > now;
    // Port: active windows are IMMUTABLE so retries don't extend recovery time
    return hasActiveWindow ? existingUntil : recomputedUntil;
}

function resetUsageStats(
    existing: ProviderUsageStats | undefined,
    overrides?: Partial<ProviderUsageStats>,
): ProviderUsageStats {
    return {
        ...existing,
        errorCount: 0,
        cooldownUntil: undefined,
        cooldownReason: undefined,
        cooldownModel: undefined,
        disabledUntil: undefined,
        disabledReason: undefined,
        failureCounts: undefined,
        ...overrides,
    };
}

// ─── computeNextUsageStats (port CoreBlow computeNextProfileUsageStats) ───────

function computeNextUsageStats(params: {
    existing: ProviderUsageStats;
    now: number;
    reason: FailoverReason;
    config: CooldownConfig;
    modelId?: string;
}): ProviderUsageStats {
    const windowMs = params.config.failureWindowMs;
    const windowExpired =
        typeof params.existing.lastFailureAt === 'number' &&
        params.existing.lastFailureAt > 0 &&
        params.now - params.existing.lastFailureAt > windowMs;

    // Port: jika previous cooldown sudah expired, reset counters
    // Ini mencegah stale error counts dari expired cooldown menyebabkan
    // next failure escalate ke cooldown yang lebih lama
    const unusableUntil = resolveProviderUnusableUntil(params.existing);
    const previousCooldownExpired = typeof unusableUntil === 'number' && params.now >= unusableUntil;

    const shouldResetCounters = windowExpired || previousCooldownExpired;
    const baseErrorCount = shouldResetCounters ? 0 : (params.existing.errorCount ?? 0);
    const nextErrorCount = baseErrorCount + 1;
    const failureCounts = shouldResetCounters ? {} : { ...params.existing.failureCounts };
    failureCounts[params.reason] = (failureCounts[params.reason] ?? 0) + 1;

    const updatedStats: ProviderUsageStats = {
        ...params.existing,
        errorCount: nextErrorCount,
        failureCounts,
        lastFailureAt: params.now,
    };

    if (params.reason === 'billing' || params.reason === 'auth_permanent') {
        // Permanent disable dengan exponential backoff
        const billingCount = failureCounts[params.reason] ?? 1;
        const backoffMs = calculateBillingDisableMsWithConfig({
            errorCount: billingCount,
            baseMs: params.config.billingBackoffMs,
            maxMs: params.config.billingMaxMs,
        });
        // Port: keep active window immutable
        updatedStats.disabledUntil = keepActiveWindowOrRecompute({
            existingUntil: params.existing.disabledUntil,
            now: params.now,
            recomputedUntil: params.now + backoffMs,
        });
        updatedStats.disabledReason = params.reason;
    } else {
        // Transient cooldown dengan stepped backoff
        const backoffMs = calculateProviderCooldownMs(nextErrorCount);
        // Port: keep active window immutable
        updatedStats.cooldownUntil = keepActiveWindowOrRecompute({
            existingUntil: params.existing.cooldownUntil,
            now: params.now,
            recomputedUntil: params.now + backoffMs,
        });

        // Model-scoped cooldown tracking
        const existingCooldownActive =
            typeof params.existing.cooldownUntil === 'number' &&
            params.existing.cooldownUntil > params.now;

        if (existingCooldownActive) {
            // Always upgrade to latest reason (port CoreBlow comment)
            updatedStats.cooldownReason = params.reason;
            // Jika model berbeda gagal dalam window yang sama → widen ke all models
            if (
                params.existing.cooldownModel &&
                params.modelId &&
                params.existing.cooldownModel !== params.modelId
            ) {
                updatedStats.cooldownModel = undefined; // widen scope
            } else if (params.reason === 'rate_limit' && !params.modelId && params.existing.cooldownModel) {
                // Unknown model saat model-scoped cooldown aktif → widen conservatively
                updatedStats.cooldownModel = undefined;
            } else if (params.reason !== 'rate_limit') {
                // Non-rate_limit = profile-wide, clear model scope
                updatedStats.cooldownModel = undefined;
            } else {
                updatedStats.cooldownModel = params.existing.cooldownModel;
            }
        } else {
            updatedStats.cooldownReason = params.reason;
            // rate_limit scope ke specific model; lainnya profile-wide
            updatedStats.cooldownModel = params.reason === 'rate_limit' ? params.modelId : undefined;
        }
    }

    return updatedStats;
}

// ─── markProviderFailure (port CoreBlow markAuthProfileFailure) ───────────────

/**
 * Mark provider:model sebagai failed. Billing/auth_permanent → disabledUntil
 * (exponential backoff 5h–24h). Lainnya → cooldownUntil (30s, 60s, 5m).
 *
 * Gunakan file lock untuk atomic concurrent write.
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts markAuthProfileFailure()
 */
export async function markProviderFailure(params: {
    store: ProviderProfileStore;
    profileId: string;
    reason: FailoverReason;
    modelId?: string;
    config?: Partial<CooldownConfig>;
    runId?: string;
}): Promise<void> {
    const { store, profileId, reason, modelId, runId } = params;
    const config: CooldownConfig = { ...DEFAULT_COOLDOWN_CONFIG, ...params.config };

    let nextStats: ProviderUsageStats | undefined;
    let previousStats: ProviderUsageStats | undefined;
    let updateTime = 0;

    const updated = await usageDeps.updateProviderProfileStoreWithLock({
        updater: (freshStore) => {
            const now = Date.now();
            previousStats = freshStore.usageStats[profileId];
            updateTime = now;
            const computed = computeNextUsageStats({
                existing: previousStats ?? {},
                now,
                reason,
                config,
                modelId,
            });
            nextStats = computed;
            updateUsageStatsEntry(freshStore, profileId, () => computed);
            return true;
        },
    });

    if (updated) {
        store.usageStats = updated.usageStats;
        if (nextStats) {
            logProviderFailureStateChange({ runId, profileId, reason, previous: previousStats, next: nextStats, now: updateTime });
        }
        return;
    }

    // Fallback: no-lock write (lock acquisition failed)
    const now = Date.now();
    previousStats = store.usageStats[profileId];
    const computed = computeNextUsageStats({
        existing: previousStats ?? {},
        now,
        reason,
        config,
        modelId,
    });
    nextStats = computed;
    updateUsageStatsEntry(store, profileId, () => computed);
    usageDeps.saveProviderProfileStore(store);
    logProviderFailureStateChange({ runId, profileId, reason, previous: previousStats, next: computed, now });
}

// ─── markProviderUsed (port CoreBlow markAuthProfileUsed) ─────────────────────

/**
 * Mark provider:model sebagai sukses digunakan.
 * Reset error count, update lastUsed.
 *
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts markAuthProfileUsed()
 */
export async function markProviderUsed(params: {
    store: ProviderProfileStore;
    profileId: string;
}): Promise<void> {
    const { store, profileId } = params;
    const updated = await usageDeps.updateProviderProfileStoreWithLock({
        updater: (freshStore) => {
            updateUsageStatsEntry(freshStore, profileId, (existing) =>
                resetUsageStats(existing, { lastUsed: Date.now() }),
            );
            return true;
        },
    });
    if (updated) {
        store.usageStats = updated.usageStats;
        return;
    }
    updateUsageStatsEntry(store, profileId, (existing) =>
        resetUsageStats(existing, { lastUsed: Date.now() }),
    );
    usageDeps.saveProviderProfileStore(store);
}

// ─── clearProviderCooldown (port CoreBlow clearAuthProfileCooldown) ───────────

/**
 * Clear cooldown untuk profile (e.g. manual reset / probe success).
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts clearAuthProfileCooldown()
 */
export async function clearProviderCooldown(params: {
    store: ProviderProfileStore;
    profileId: string;
}): Promise<void> {
    const { store, profileId } = params;
    const updated = await usageDeps.updateProviderProfileStoreWithLock({
        updater: (freshStore) => {
            if (!freshStore.usageStats[profileId]) return false;
            updateUsageStatsEntry(freshStore, profileId, (existing) => resetUsageStats(existing));
            return true;
        },
    });
    if (updated) {
        store.usageStats = updated.usageStats;
        return;
    }
    if (!store.usageStats[profileId]) return;
    updateUsageStatsEntry(store, profileId, (existing) => resetUsageStats(existing));
    usageDeps.saveProviderProfileStore(store);
}

// ─── clearExpiredCooldowns (port from OC) ────────────────────────────────────

/**
 * Clear expired cooldowns dari semua profiles.
 * Reset error counters saat semua cooldowns expired (circuit-breaker half-open → closed).
 * Mutates in-memory; disk persistence lazy on next write.
 *
 * Port identik dari coreblow/src/agents/auth-profiles/usage.ts clearExpiredCooldowns()
 */
export function clearExpiredCooldowns(store: ProviderProfileStore, now?: number): boolean {
    const { usageStats } = store;
    if (!usageStats) return false;
    const ts = now ?? Date.now();
    let mutated = false;

    for (const [profileId, stats] of Object.entries(usageStats)) {
        if (!stats) continue;
        let profileMutated = false;

        const cooldownExpired =
            typeof stats.cooldownUntil === 'number' &&
            Number.isFinite(stats.cooldownUntil) &&
            stats.cooldownUntil > 0 &&
            ts >= stats.cooldownUntil;

        const disabledExpired =
            typeof stats.disabledUntil === 'number' &&
            Number.isFinite(stats.disabledUntil) &&
            stats.disabledUntil > 0 &&
            ts >= stats.disabledUntil;

        if (cooldownExpired) {
            stats.cooldownUntil = undefined;
            stats.cooldownReason = undefined;
            stats.cooldownModel = undefined;
            profileMutated = true;
        }
        if (disabledExpired) {
            stats.disabledUntil = undefined;
            stats.disabledReason = undefined;
            profileMutated = true;
        }

        // Reset error counters saat ALL cooldowns expired (circuit-breaker)
        // Preserves lastFailureAt untuk failureWindowMs decay check
        if (profileMutated && !resolveProviderUnusableUntil(stats)) {
            stats.errorCount = 0;
            stats.failureCounts = undefined;
        }

        if (profileMutated) {
            usageStats[profileId] = stats;
            mutated = true;
        }
    }
    return mutated;
}

// ─── State observation logging ────────────────────────────────────────────────

function logProviderFailureStateChange(params: {
    runId?: string;
    profileId: string;
    reason: FailoverReason;
    previous: ProviderUsageStats | undefined;
    next: ProviderUsageStats;
    now: number;
}): void {
    const { profileId, reason, previous, next, now } = params;
    const cooldownDeltaMs = next.cooldownUntil ? next.cooldownUntil - now : 0;
    const disabledDeltaMs = next.disabledUntil ? next.disabledUntil - now : 0;

    log.warn(
        {
            event: 'provider_cooldown_state_change',
            runId: params.runId,
            profileId,
            reason,
            errorCount: { from: previous?.errorCount ?? 0, to: next.errorCount },
            cooldown: {
                from: previous?.cooldownUntil ?? null,
                to: next.cooldownUntil ?? null,
                deltaMs: cooldownDeltaMs || undefined,
            },
            disabled: {
                from: previous?.disabledUntil ?? null,
                to: next.disabledUntil ?? null,
                deltaMs: disabledDeltaMs || undefined,
            },
            cooldownModel: next.cooldownModel ?? null,
        },
        `provider cooldown state change: ${profileId} reason=${reason} errorCount=${next.errorCount}`,
    );
}
