/**
 * src/gateway/priority.ts
 * Priority routing — VIP users, channel priority, load balancing
 * SUPERIOR: CoreBlow = flat routing; CoreBlow = priority tiers + VIP + load-aware
 */

import { createChildLogger } from '../utils/logger.js';
import type { InboundMessage } from './router.js';

const log = createChildLogger('priority');

// ─── Types ────────────────────────────────────────────────────────

export type PriorityTier = 'critical' | 'high' | 'normal' | 'low' | 'bulk';

export interface PriorityRule {
    id: string;
    /** Match condition */
    match: {
        userId?: string;
        userIds?: string[];
        channel?: string;
        channelGroup?: string;
        pattern?: RegExp;
    };
    /** Assigned priority */
    priority: PriorityTier;
    /** Optional: custom model for this tier */
    model?: string;
    /** Optional: custom provider for this tier */
    provider?: string;
    /** Optional: max concurrent for this tier */
    maxConcurrent?: number;
    /** Description */
    description?: string;
}

export interface PriorityResult {
    tier: PriorityTier;
    rule?: PriorityRule;
    weight: number;
    model?: string;
    provider?: string;
}

export interface LoadInfo {
    channel: string;
    activeRequests: number;
    avgResponseTime: number;
    errorRate: number;
    lastUpdated: number;
}

// ─── Priority Router ─────────────────────────────────────────────

const TIER_WEIGHTS: Record<PriorityTier, number> = {
    critical: 100,
    high: 75,
    normal: 50,
    low: 25,
    bulk: 10,
};

export class PriorityRouter {
    private rules: PriorityRule[] = [];
    private vipUsers = new Set<string>();
    private channelLoad = new Map<string, LoadInfo>();
    private tierCounts = new Map<PriorityTier, number>();

    /**
     * Add a priority rule
     */
    addRule(rule: PriorityRule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => TIER_WEIGHTS[b.priority] - TIER_WEIGHTS[a.priority]);
        log.debug({ id: rule.id, priority: rule.priority }, 'Priority rule added');
    }

    /**
     * Remove a rule
     */
    removeRule(id: string): boolean {
        const idx = this.rules.findIndex(r => r.id === id);
        if (idx < 0) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    /**
     * Add VIP users
     */
    addVip(userId: string): void {
        this.vipUsers.add(userId);
    }

    /**
     * Remove VIP
     */
    removeVip(userId: string): boolean {
        return this.vipUsers.delete(userId);
    }

    /**
     * Check if user is VIP
     */
    isVip(userId: string): boolean {
        return this.vipUsers.has(userId);
    }

    /**
     * Resolve priority for a message
     */
    resolve(message: InboundMessage): PriorityResult {
        // VIP users always get high priority
        if (this.vipUsers.has(message.senderId)) {
            return {
                tier: 'high',
                weight: TIER_WEIGHTS.high,
            };
        }

        // Check rules
        for (const rule of this.rules) {
            if (this.matchesRule(message, rule)) {
                return {
                    tier: rule.priority,
                    rule,
                    weight: TIER_WEIGHTS[rule.priority],
                    model: rule.model,
                    provider: rule.provider,
                };
            }
        }

        // Default: normal
        return { tier: 'normal', weight: TIER_WEIGHTS.normal };
    }

    /**
     * Update load info for a channel
     */
    updateLoad(channel: string, activeRequests: number, avgResponseTime: number, errorRate: number): void {
        this.channelLoad.set(channel, {
            channel,
            activeRequests,
            avgResponseTime,
            errorRate,
            lastUpdated: Date.now(),
        });
    }

    /**
     * Get the least-loaded channel (for load balancing)
     */
    getLeastLoaded(): string | undefined {
        let best: string | undefined;
        let bestScore = Infinity;

        for (const [channel, load] of this.channelLoad) {
            // Score = active requests * (1 + error rate) * response time
            const score = load.activeRequests * (1 + load.errorRate) * (load.avgResponseTime || 1);
            if (score < bestScore) {
                bestScore = score;
                best = channel;
            }
        }

        return best;
    }

    /**
     * Get load info for all channels
     */
    getLoadInfo(): LoadInfo[] {
        return [...this.channelLoad.values()];
    }

    /**
     * Record a tier usage for stats
     */
    recordTierUsage(tier: PriorityTier): void {
        this.tierCounts.set(tier, (this.tierCounts.get(tier) || 0) + 1);
    }

    /**
     * Get stats
     */
    getStats(): { rules: number; vipUsers: number; tierUsage: Record<string, number>; channels: number } {
        const tierUsage: Record<string, number> = {};
        for (const [tier, count] of this.tierCounts) {
            tierUsage[tier] = count;
        }

        return {
            rules: this.rules.length,
            vipUsers: this.vipUsers.size,
            tierUsage,
            channels: this.channelLoad.size,
        };
    }

    /**
     * List all rules
     */
    listRules(): PriorityRule[] {
        return [...this.rules];
    }

    // ─── Private ─────────────────────────────────────────────

    private matchesRule(message: InboundMessage, rule: PriorityRule): boolean {
        const { match } = rule;

        if (match.userId && message.senderId !== match.userId) return false;
        if (match.userIds && !match.userIds.includes(message.senderId)) return false;
        if (match.channel && message.channel !== match.channel) return false;
        if (match.pattern && !match.pattern.test(message.text)) return false;

        return true;
    }
}
