/**
 * src/security/auth-profiles.ts
 * OAuth Auth Profiles + Smart Key Management + Cost Tracking
 * SUPERIOR: CoreBlow has key rotation; CoreBlow adds cost tracking, budget alerts, smart routing
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:auth-profiles');

// --- Types ---

export interface AuthCredential {
    type: 'api-key' | 'oauth-token';
    value: string;
    provider: string;
    label?: string;
    createdAt: number;
    expiresAt?: number;
    lastUsedAt?: number;
}

export interface UsageRecord {
    provider: string;
    keyLabel: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    timestamp: number;
}

export interface AuthProfile {
    id: string;
    provider: string;
    credentials: AuthCredential[];
    activeIndex: number;
    // Rate limit tracking
    cooldowns: Map<number, number>;   // credIndex → cooldownUntil
    failures: Map<number, number>;    // credIndex → failureCount
    // Cost tracking (SUPERIOR — CoreBlow doesn't have this)
    usage: {
        dailyCostUsd: number;
        monthlyCostUsd: number;
        totalTokens: number;
        lastResetDay: string;
        lastResetMonth: string;
    };
    budgetLimitUsd?: number;
}

export interface AuthProfileStoreData {
    version: number;
    profiles: Record<string, {
        id: string;
        provider: string;
        credentials: AuthCredential[];
        activeIndex: number;
        usage: AuthProfile['usage'];
        budgetLimitUsd?: number;
    }>;
}

// --- Cost estimation per 1M tokens ---
const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
    'openai': { input: 2.50, output: 10.00 },   // GPT-4o
    'anthropic': { input: 3.00, output: 15.00 },   // Claude 3.5 Sonnet
    'gemini': { input: 0.075, output: 0.30 },    // Gemini 1.5 Flash
    'mistral': { input: 2.00, output: 6.00 },     // Mistral Large
    'groq': { input: 0.59, output: 0.79 },     // Llama 3.3 70B
    'deepseek': { input: 0.14, output: 0.28 },     // DeepSeek Chat
    'openrouter': { input: 1.00, output: 3.00 },     // Average
    'ollama': { input: 0, output: 0 },            // Free (local)
};

// --- Auth Profile Store ---

export class AuthProfileStore {
    private profiles = new Map<string, AuthProfile>();
    private storePath: string;
    private usageLog: UsageRecord[] = [];

    constructor(storagePath: string) {
        this.storePath = storagePath;
        this.load();
    }

    /**
     * Add or update credentials for a provider
     */
    upsertProfile(provider: string, credentials: AuthCredential[], opts?: {
        budgetLimitUsd?: number;
    }): AuthProfile {
        const existing = this.profiles.get(provider);
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);

        const profile: AuthProfile = {
            id: existing?.id || crypto.randomUUID(),
            provider,
            credentials,
            activeIndex: 0,
            cooldowns: existing?.cooldowns || new Map(),
            failures: existing?.failures || new Map(),
            usage: existing?.usage || {
                dailyCostUsd: 0,
                monthlyCostUsd: 0,
                totalTokens: 0,
                lastResetDay: today,
                lastResetMonth: month,
            },
            budgetLimitUsd: opts?.budgetLimitUsd ?? existing?.budgetLimitUsd,
        };

        this.profiles.set(provider, profile);
        this.save();
        log.info({ provider, keyCount: credentials.length }, 'Auth profile updated');
        return profile;
    }

    /**
     * Get the best available credential for a provider
     * Skips keys on cooldown, rotates to healthy keys
     */
    getActiveCredential(provider: string): AuthCredential | null {
        const profile = this.profiles.get(provider);
        if (!profile || profile.credentials.length === 0) return null;

        const now = Date.now();

        // Check budget
        if (profile.budgetLimitUsd && profile.usage.monthlyCostUsd >= profile.budgetLimitUsd) {
            log.warn({ provider, budget: profile.budgetLimitUsd, spent: profile.usage.monthlyCostUsd }, 'Budget limit reached');
            return null;
        }

        // Try active key first
        const cooldown = profile.cooldowns.get(profile.activeIndex) || 0;
        if (cooldown < now) {
            return profile.credentials[profile.activeIndex];
        }

        // Rotate to next available key
        for (let i = 0; i < profile.credentials.length; i++) {
            const idx = (profile.activeIndex + i + 1) % profile.credentials.length;
            const cd = profile.cooldowns.get(idx) || 0;
            if (cd < now) {
                profile.activeIndex = idx;
                log.info({ provider, newIndex: idx }, 'Rotated to next API key');
                return profile.credentials[idx];
            }
        }

        log.warn({ provider }, 'All keys on cooldown');
        return null;
    }

    /**
     * Mark a key as failed — triggers cooldown
     */
    markFailure(provider: string, error?: string): void {
        const profile = this.profiles.get(provider);
        if (!profile) return;

        const idx = profile.activeIndex;
        const failures = (profile.failures.get(idx) || 0) + 1;
        profile.failures.set(idx, failures);

        // Escalating cooldown: 30s, 1m, 2m, 5m, 15m
        const cooldownMs = Math.min(30_000 * Math.pow(2, failures - 1), 900_000);
        profile.cooldowns.set(idx, Date.now() + cooldownMs);

        log.warn({ provider, keyIndex: idx, failures, cooldownMs, error }, 'Key failure recorded');

        // Auto-rotate
        this.getActiveCredential(provider);
    }

    /**
     * Mark successful usage — reset failures, track cost
     * SUPERIOR: CoreBlow doesn't track costs
     */
    markSuccess(provider: string, usage: { promptTokens: number; completionTokens: number }): void {
        const profile = this.profiles.get(provider);
        if (!profile) return;

        const idx = profile.activeIndex;
        profile.failures.set(idx, 0);
        profile.credentials[idx].lastUsedAt = Date.now();

        // Cost calculation
        const pricing = COST_PER_MILLION[provider] || { input: 1, output: 3 };
        const costUsd =
            (usage.promptTokens / 1_000_000) * pricing.input +
            (usage.completionTokens / 1_000_000) * pricing.output;

        // Reset daily/monthly counters if needed
        const today = new Date().toISOString().split('T')[0];
        const month = today.substring(0, 7);

        if (profile.usage.lastResetDay !== today) {
            profile.usage.dailyCostUsd = 0;
            profile.usage.lastResetDay = today;
        }
        if (profile.usage.lastResetMonth !== month) {
            profile.usage.monthlyCostUsd = 0;
            profile.usage.lastResetMonth = month;
        }

        profile.usage.dailyCostUsd += costUsd;
        profile.usage.monthlyCostUsd += costUsd;
        profile.usage.totalTokens += usage.promptTokens + usage.completionTokens;

        // Log usage
        this.usageLog.push({
            provider,
            keyLabel: profile.credentials[idx].label || `key-${idx}`,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.promptTokens + usage.completionTokens,
            estimatedCostUsd: costUsd,
            timestamp: Date.now(),
        });

        // Keep log manageable
        if (this.usageLog.length > 10_000) {
            this.usageLog = this.usageLog.slice(-5_000);
        }

        // Budget warning at 80%
        if (profile.budgetLimitUsd) {
            const pct = (profile.usage.monthlyCostUsd / profile.budgetLimitUsd) * 100;
            if (pct >= 80 && pct < 81) {
                log.warn({ provider, spent: profile.usage.monthlyCostUsd, budget: profile.budgetLimitUsd }, '⚠️ 80% of monthly budget used');
            }
        }

        this.save();
    }

    /**
     * Get stats for all providers
     */
    getStats(): Record<string, {
        provider: string;
        keyCount: number;
        activeKey: number;
        dailyCost: string;
        monthlyCost: string;
        totalTokens: number;
        budget?: string;
        budgetUsedPct?: number;
        healthyKeys: number;
    }> {
        const stats: Record<string, { provider: string; keyCount: number; activeKey: number; dailyCost: string; monthlyCost: string; totalTokens: number; budget?: string; budgetUsedPct?: number; healthyKeys: number; }> = {};
        const now = Date.now();

        for (const [provider, profile] of this.profiles) {
            const healthyKeys = profile.credentials.filter((_, i) =>
                (profile.cooldowns.get(i) || 0) < now
            ).length;

            stats[provider] = {
                provider,
                keyCount: profile.credentials.length,
                activeKey: profile.activeIndex,
                dailyCost: `$${profile.usage.dailyCostUsd.toFixed(4)}`,
                monthlyCost: `$${profile.usage.monthlyCostUsd.toFixed(4)}`,
                totalTokens: profile.usage.totalTokens,
                healthyKeys,
                ...(profile.budgetLimitUsd ? {
                    budget: `$${profile.budgetLimitUsd}`,
                    budgetUsedPct: Math.round((profile.usage.monthlyCostUsd / profile.budgetLimitUsd) * 100),
                } : {}),
            };
        }

        return stats;
    }

    /**
     * Get recent usage log
     */
    getUsageLog(limit = 100): UsageRecord[] {
        return this.usageLog.slice(-limit);
    }

    getProfile(provider: string): AuthProfile | undefined {
        return this.profiles.get(provider);
    }

    listProviders(): string[] {
        return Array.from(this.profiles.keys());
    }

    deleteProfile(provider: string): boolean {
        const deleted = this.profiles.delete(provider);
        if (deleted) this.save();
        return deleted;
    }

    // --- Persistence ---

    private load(): void {
        try {
            if (!fs.existsSync(this.storePath)) return;
            const data: AuthProfileStoreData = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
            for (const [provider, p] of Object.entries(data.profiles)) {
                this.profiles.set(provider, {
                    ...p,
                    cooldowns: new Map(),
                    failures: new Map(),
                });
            }
            log.info({ count: this.profiles.size }, 'Auth profiles loaded');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error({ err: msg }, 'Failed to load auth profiles');
        }
    }

    private save(): void {
        try {
            const dir = path.dirname(this.storePath);
            fs.mkdirSync(dir, { recursive: true });

            const data: AuthProfileStoreData = {
                version: 1,
                profiles: {},
            };
            for (const [provider, p] of this.profiles) {
                data.profiles[provider] = {
                    id: p.id,
                    provider: p.provider,
                    credentials: p.credentials,
                    activeIndex: p.activeIndex,
                    usage: p.usage,
                    budgetLimitUsd: p.budgetLimitUsd,
                };
            }

            fs.writeFileSync(this.storePath, JSON.stringify(data, null, 2));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error({ err: msg }, 'Failed to save auth profiles');
        }
    }
}
