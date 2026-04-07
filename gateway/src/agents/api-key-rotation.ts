/**
 * CoreBlow API Key Rotation
 *
 * Manages per-provider API key rotation with health tracking,
 * rate limit awareness, and automatic failover.
 *
 * Equivalent: CoreBlow src/agents/api-key-rotation.ts (72 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { normalizeProviderId } from './model-selection.js';

const log = createChildLogger('api-key-rotation');

// ─── Types ────────────────────────────────────────────────────────

export interface RotatableKey {
    key: string;
    label?: string;
    weight: number;
    healthy: boolean;
    lastUsed: number;
    errorCount: number;
    rateLimitedUntil: number;
}

export interface KeyPoolStats {
    provider: string;
    totalKeys: number;
    healthyKeys: number;
    rateLimitedKeys: number;
    totalErrors: number;
    rotations: number;
}

// ─── Key Pool ─────────────────────────────────────────────────────

const pools = new Map<string, RotatableKey[]>();
const rotationCounts = new Map<string, number>();

/**
 * Register API keys for rotation
 */
export function registerKeys(provider: string, keys: Array<{ key: string; label?: string; weight?: number }>): void {
    const normalized = normalizeProviderId(provider);
    const rotatable: RotatableKey[] = keys.map((k) => ({
        key: k.key,
        label: k.label,
        weight: k.weight ?? 1,
        healthy: true,
        lastUsed: 0,
        errorCount: 0,
        rateLimitedUntil: 0,
    }));
    pools.set(normalized, rotatable);
    rotationCounts.set(normalized, 0);
    log.info({ provider: normalized, keyCount: keys.length }, 'Key pool registered');
}

/**
 * Get the next available key using weighted round-robin
 */
export function getNextKey(provider: string): string | null {
    const normalized = normalizeProviderId(provider);
    const pool = pools.get(normalized);
    if (!pool || pool.length === 0) return null;

    const now = Date.now();

    // Reset rate-limited keys whose cooldown has expired
    for (const key of pool) {
        if (key.rateLimitedUntil > 0 && key.rateLimitedUntil <= now) {
            key.rateLimitedUntil = 0;
            key.healthy = true;
        }
    }

    // Find available keys (healthy + not rate-limited)
    const available = pool.filter((k) => k.healthy && k.rateLimitedUntil <= now);
    if (available.length === 0) {
        // All keys exhausted, try least-recently-used regardless
        const lru = [...pool].sort((a, b) => a.lastUsed - b.lastUsed);
        const fallback = lru[0];
        if (fallback) {
            fallback.lastUsed = now;
            log.warn({ provider: normalized }, 'All keys exhausted, using LRU fallback');
            return fallback.key;
        }
        return null;
    }

    // Weighted selection: pick the one with highest weight and least recent use
    available.sort((a, b) => {
        if (a.weight !== b.weight) return b.weight - a.weight;
        return a.lastUsed - b.lastUsed;
    });

    const selected = available[0]!;
    selected.lastUsed = now;
    rotationCounts.set(normalized, (rotationCounts.get(normalized) ?? 0) + 1);

    return selected.key;
}

/**
 * Report an error for a key
 */
export function reportKeyError(provider: string, key: string, isRateLimit: boolean = false): void {
    const normalized = normalizeProviderId(provider);
    const pool = pools.get(normalized);
    if (!pool) return;

    const entry = pool.find((k) => k.key === key);
    if (!entry) return;

    entry.errorCount++;

    if (isRateLimit) {
        // Set rate-limit cooldown (exponential backoff: 10s, 30s, 60s, 120s...)
        const backoffMs = Math.min(10_000 * Math.pow(2, entry.errorCount - 1), 300_000);
        entry.rateLimitedUntil = Date.now() + backoffMs;
        entry.healthy = false;
        log.warn({ provider: normalized, backoffMs, errorCount: entry.errorCount }, 'Key rate-limited');
    } else if (entry.errorCount >= 3) {
        entry.healthy = false;
        log.warn({ provider: normalized, errorCount: entry.errorCount }, 'Key marked unhealthy');
    }
}

/**
 * Report a key success (reset error count)
 */
export function reportKeySuccess(provider: string, key: string): void {
    const normalized = normalizeProviderId(provider);
    const pool = pools.get(normalized);
    if (!pool) return;

    const entry = pool.find((k) => k.key === key);
    if (!entry) return;

    entry.errorCount = 0;
    entry.healthy = true;
    entry.rateLimitedUntil = 0;
}

/**
 * Get pool statistics
 */
export function getPoolStats(provider: string): KeyPoolStats | null {
    const normalized = normalizeProviderId(provider);
    const pool = pools.get(normalized);
    if (!pool) return null;

    const now = Date.now();
    return {
        provider: normalized,
        totalKeys: pool.length,
        healthyKeys: pool.filter((k) => k.healthy && k.rateLimitedUntil <= now).length,
        rateLimitedKeys: pool.filter((k) => k.rateLimitedUntil > now).length,
        totalErrors: pool.reduce((sum, k) => sum + k.errorCount, 0),
        rotations: rotationCounts.get(normalized) ?? 0,
    };
}

/**
 * Clear a provider's key pool
 */
export function clearPool(provider: string): void {
    const normalized = normalizeProviderId(provider);
    pools.delete(normalized);
    rotationCounts.delete(normalized);
}

/**
 * Clear all key pools
 */
export function clearAllPools(): void {
    pools.clear();
    rotationCounts.clear();
}

/**
 * Check if the pool has any healthy keys
 */
export function hasHealthyKeys(provider: string): boolean {
    const normalized = normalizeProviderId(provider);
    const pool = pools.get(normalized);
    if (!pool) return false;
    const now = Date.now();
    return pool.some((k) => k.healthy && k.rateLimitedUntil <= now);
}
