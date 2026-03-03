/**
 * src/providers/key-rotation.ts
 * API Key Rotation — multi-key management with auto-failover and cooldown
 * SUPERIOR: CoreBlow has auth-profiles; CoreBlow adds smart scoring + auto-heal + usage tracking
 */

import { clamp } from "../utils.js";
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('providers:key-rotation');

// ─── Types ────────────────────────────────────────────────────────

export interface ApiKeyProfile {
    id: string;
    key: string;
    provider: string;
    /** Label for UI/logs */
    label?: string;
    /** Enabled state */
    enabled: boolean;
    /** Priority (lower = preferred) */
    priority: number;
}

export interface KeyHealth {
    keyId: string;
    successCount: number;
    failureCount: number;
    consecutiveFailures: number;
    lastSuccess: number;
    lastFailure: number;
    lastError?: string;
    /** Cooldown until this time (ms epoch) */
    cooldownUntil: number;
    /** Running average response time (ms) */
    avgResponseTime: number;
    /** Total requests */
    totalRequests: number;
    /** Health score 0-1 (higher = healthier) */
    score: number;
}

export interface KeyRotationConfig {
    /** Max consecutive failures before cooldown */
    maxConsecutiveFailures: number;
    /** Cooldown duration (ms) — default 5 minutes */
    cooldownMs: number;
    /** Cooldown multiplier for repeated failures */
    cooldownBackoffMultiplier: number;
    /** Max cooldown (ms) — default 1 hour */
    maxCooldownMs: number;
    /** Auto-heal: try recovering cooled-down keys periodically */
    autoHealIntervalMs: number;
    /** Strategy for key selection */
    strategy: 'round-robin' | 'least-used' | 'fastest' | 'healthiest';
    /** Errors that indicate the key is permanently bad (don't retry) */
    permanentErrors: string[];
}

const DEFAULT_CONFIG: KeyRotationConfig = {
    maxConsecutiveFailures: 3,
    cooldownMs: 5 * 60 * 1000,
    cooldownBackoffMultiplier: 2,
    maxCooldownMs: 60 * 60 * 1000,
    autoHealIntervalMs: 10 * 60 * 1000,
    strategy: 'healthiest',
    permanentErrors: ['invalid_api_key', 'account_deactivated', 'billing_not_active'],
};

// ─── Key Rotation Manager ────────────────────────────────────────

export class KeyRotationManager {
    private keys = new Map<string, ApiKeyProfile>();
    private health = new Map<string, KeyHealth>();
    private config: KeyRotationConfig;
    private roundRobinIndex = 0;
    private healTimer: ReturnType<typeof setInterval> | null = null;

    constructor(config?: Partial<KeyRotationConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Add an API key profile
     */
    addKey(profile: ApiKeyProfile): void {
        this.keys.set(profile.id, { ...profile });
        this.health.set(profile.id, {
            keyId: profile.id,
            successCount: 0,
            failureCount: 0,
            consecutiveFailures: 0,
            lastSuccess: 0,
            lastFailure: 0,
            cooldownUntil: 0,
            avgResponseTime: 0,
            totalRequests: 0,
            score: 1.0,
        });
        log.info({ id: profile.id, provider: profile.provider, label: profile.label }, 'Key added');
    }

    /**
     * Remove an API key
     */
    removeKey(id: string): boolean {
        const deleted = this.keys.delete(id);
        this.health.delete(id);
        return deleted;
    }

    /**
     * Get the best available key based on strategy
     */
    getKey(provider?: string): ApiKeyProfile | null {
        const candidates = this.getAvailableKeys(provider);
        if (candidates.length === 0) {
            log.warn({ provider }, 'No available keys');
            return null;
        }

        switch (this.config.strategy) {
            case 'round-robin':
                return this.roundRobin(candidates);
            case 'least-used':
                return this.leastUsed(candidates);
            case 'fastest':
                return this.fastest(candidates);
            case 'healthiest':
            default:
                return this.healthiest(candidates);
        }
    }

    /**
     * Report a successful API call
     */
    reportSuccess(keyId: string, responseTimeMs: number): void {
        const h = this.health.get(keyId);
        if (!h) return;

        h.successCount++;
        h.totalRequests++;
        h.consecutiveFailures = 0;
        h.lastSuccess = Date.now();
        h.cooldownUntil = 0;

        // Exponential moving average for response time
        h.avgResponseTime = h.avgResponseTime === 0
            ? responseTimeMs
            : h.avgResponseTime * 0.8 + responseTimeMs * 0.2;

        this.updateScore(h);
    }

    /**
     * Report a failed API call — may trigger cooldown
     */
    reportFailure(keyId: string, error: string): void {
        const h = this.health.get(keyId);
        if (!h) return;

        h.failureCount++;
        h.totalRequests++;
        h.consecutiveFailures++;
        h.lastFailure = Date.now();
        h.lastError = error;

        // Check for permanent errors
        if (this.isPermanentError(error)) {
            const key = this.keys.get(keyId);
            if (key) {
                key.enabled = false;
                log.error({ keyId, error }, 'Key permanently disabled');
            }
            return;
        }

        // Trigger cooldown if too many failures
        if (h.consecutiveFailures >= this.config.maxConsecutiveFailures) {
            const baseCooldown = this.config.cooldownMs;
            const multiplier = Math.pow(this.config.cooldownBackoffMultiplier, Math.floor(h.consecutiveFailures / this.config.maxConsecutiveFailures) - 1);
            const cooldown = Math.min(baseCooldown * multiplier, this.config.maxCooldownMs);
            h.cooldownUntil = Date.now() + cooldown;
            log.warn({ keyId, cooldownMs: cooldown, failures: h.consecutiveFailures }, 'Key on cooldown');
        }

        this.updateScore(h);
    }

    /**
     * Get available keys (enabled + not on cooldown)
     */
    getAvailableKeys(provider?: string): ApiKeyProfile[] {
        const now = Date.now();
        return Array.from(this.keys.values()).filter(key => {
            if (!key.enabled) return false;
            if (provider && key.provider !== provider) return false;
            const h = this.health.get(key.id);
            if (h && h.cooldownUntil > now) return false;
            return true;
        });
    }

    /**
     * Get health info for all keys
     */
    getHealthReport(): Array<{ profile: ApiKeyProfile; health: KeyHealth }> {
        return Array.from(this.keys.values()).map(key => ({
            profile: { ...key, key: key.key.substring(0, 8) + '...' },
            health: { ...this.health.get(key.id)! },
        }));
    }

    /**
     * Get stats summary
     */
    getStats() {
        const keys = Array.from(this.keys.values());
        const healths = Array.from(this.health.values());
        const now = Date.now();

        return {
            totalKeys: keys.length,
            enabledKeys: keys.filter(k => k.enabled).length,
            availableKeys: this.getAvailableKeys().length,
            onCooldown: healths.filter(h => h.cooldownUntil > now).length,
            totalRequests: healths.reduce((s, h) => s + h.totalRequests, 0),
            totalSuccess: healths.reduce((s, h) => s + h.successCount, 0),
            totalFailures: healths.reduce((s, h) => s + h.failureCount, 0),
            avgResponseTime: healths.length > 0
                ? healths.reduce((s, h) => s + h.avgResponseTime, 0) / healths.length
                : 0,
        };
    }

    /**
     * Start auto-heal timer — periodically test cooled-down keys
     */
    startAutoHeal(): void {
        if (this.healTimer) return;
        this.healTimer = setInterval(() => {
            const now = Date.now();
            for (const h of this.health.values()) {
                if (h.cooldownUntil > 0 && h.cooldownUntil <= now) {
                    // Cooldown expired, reset for retry
                    h.cooldownUntil = 0;
                    h.consecutiveFailures = Math.max(0, h.consecutiveFailures - 1);
                    this.updateScore(h);
                    log.info({ keyId: h.keyId }, 'Key auto-healed from cooldown');
                }
            }
        }, this.config.autoHealIntervalMs);
    }

    /**
     * Stop auto-heal timer
     */
    stopAutoHeal(): void {
        if (this.healTimer) {
            clearInterval(this.healTimer);
            this.healTimer = null;
        }
    }

    /**
     * Force reset a key's health
     */
    resetKey(keyId: string): boolean {
        const h = this.health.get(keyId);
        if (!h) return false;
        h.consecutiveFailures = 0;
        h.cooldownUntil = 0;
        h.score = 1.0;
        const key = this.keys.get(keyId);
        if (key) key.enabled = true;
        return true;
    }

    // ─── Selection Strategies ────────────────────────────────────

    private roundRobin(candidates: ApiKeyProfile[]): ApiKeyProfile {
        this.roundRobinIndex = this.roundRobinIndex % candidates.length;
        return candidates[this.roundRobinIndex++];
    }

    private leastUsed(candidates: ApiKeyProfile[]): ApiKeyProfile {
        return candidates.reduce((best, key) => {
            const hBest = this.health.get(best.id)!;
            const hKey = this.health.get(key.id)!;
            return hKey.totalRequests < hBest.totalRequests ? key : best;
        });
    }

    private fastest(candidates: ApiKeyProfile[]): ApiKeyProfile {
        return candidates.reduce((best, key) => {
            const hBest = this.health.get(best.id)!;
            const hKey = this.health.get(key.id)!;
            if (hKey.avgResponseTime === 0) return key; // untested = try first
            return hKey.avgResponseTime < hBest.avgResponseTime ? key : best;
        });
    }

    private healthiest(candidates: ApiKeyProfile[]): ApiKeyProfile {
        return candidates.reduce((best, key) => {
            const hBest = this.health.get(best.id)!;
            const hKey = this.health.get(key.id)!;
            return hKey.score > hBest.score ? key : best;
        });
    }

    // ─── Scoring ─────────────────────────────────────────────────

    private updateScore(h: KeyHealth): void {
        const successRate = h.totalRequests > 0 ? h.successCount / h.totalRequests : 1;
        const failurePenalty = Math.min(h.consecutiveFailures * 0.2, 0.8);
        const cooldownPenalty = h.cooldownUntil > Date.now() ? 0.5 : 0;

        // Speed bonus (normalize: 0-1 where faster = higher)
        const speedBonus = h.avgResponseTime > 0 ? Math.max(0, 1 - h.avgResponseTime / 10000) * 0.2 : 0;

        h.score = clamp(successRate - failurePenalty - cooldownPenalty + speedBonus, 0, 1);
    }

    private isPermanentError(error: string): boolean {
        const lower = error.toLowerCase();
        return this.config.permanentErrors.some(pe => lower.includes(pe.toLowerCase()));
    }
}
