/**
 * CoreBlow — Auto-Reply Engine
 *
 * Configurable auto-reply system for common patterns.
 * Supports regex matching, keyword triggers, time-based
 * responses, and custom reply chains.
 */

/** Auto-reply rule */
export interface AutoReplyRule {
    id: string;
    name: string;
    pattern: string | RegExp;
    reply: string | ((match: string, groups?: Record<string, string>) => string);
    /** Channels to apply to (empty = all) */
    channels?: string[];
    /** Max replies per user per window */
    rateLimit?: number;
    /** Rate limit window in ms */
    rateLimitWindow?: number;
    enabled: boolean;
    priority: number;
    /** Cooldown between triggers in ms */
    cooldownMs?: number;
}

/** Reply result */
export interface ReplyResult {
    matched: boolean;
    ruleId?: string;
    reply?: string;
    rateLimited?: boolean;
}

/**
 * CoreBlow Auto-Reply Engine
 */
export class AutoReplyEngine {
    private rules: AutoReplyRule[] = [];
    private userCounts = new Map<string, Map<string, { count: number; resetAt: number }>>();
    private lastTrigger = new Map<string, number>(); // ruleId → timestamp

    constructor() {
        // Built-in rules
        this.addRule({
            id: 'greeting', name: 'Greeting', pattern: /^(hi|hello|hey|halo)\b/i,
            reply: 'Hello! How can I help you today? 😊', enabled: true, priority: 1,
        });
        this.addRule({
            id: 'thanks', name: 'Thanks', pattern: /^(thanks|thank you|thx|terima kasih)\b/i,
            reply: "You're welcome! Let me know if you need anything else.", enabled: true, priority: 1,
        });
        this.addRule({
            id: 'bye', name: 'Goodbye', pattern: /^(bye|goodbye|selamat tinggal)\b/i,
            reply: 'Goodbye! Have a great day! 👋', enabled: true, priority: 1,
        });
    }

    /**
     * Add a reply rule.
     */
    addRule(rule: AutoReplyRule): void {
        this.rules.push(rule);
        this.rules.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Process a message and get auto-reply.
     */
    process(message: string, userId?: string, channel?: string): ReplyResult {
        for (const rule of this.rules) {
            if (!rule.enabled) continue;
            if (rule.channels && rule.channels.length > 0 && channel && !rule.channels.includes(channel)) continue;

            // Cooldown check
            if (rule.cooldownMs) {
                const last = this.lastTrigger.get(rule.id) ?? 0;
                if (Date.now() - last < rule.cooldownMs) continue;
            }

            const regex = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
            const match = message.match(regex);

            if (match) {
                // Rate limit check
                if (rule.rateLimit && userId) {
                    if (this.isRateLimited(userId, rule.id, rule.rateLimit, rule.rateLimitWindow ?? 60_000)) {
                        return { matched: true, ruleId: rule.id, rateLimited: true };
                    }
                }

                this.lastTrigger.set(rule.id, Date.now());

                const reply = typeof rule.reply === 'function'
                    ? rule.reply(match[0], match.groups)
                    : rule.reply;

                return { matched: true, ruleId: rule.id, reply };
            }
        }

        return { matched: false };
    }

    /**
     * Enable/disable a rule.
     */
    setEnabled(ruleId: string, enabled: boolean): boolean {
        const rule = this.rules.find((r) => r.id === ruleId);
        if (!rule) return false;
        rule.enabled = enabled;
        return true;
    }

    /**
     * Remove a rule.
     */
    removeRule(ruleId: string): boolean {
        const idx = this.rules.findIndex((r) => r.id === ruleId);
        if (idx === -1) return false;
        this.rules.splice(idx, 1);
        return true;
    }

    /**
     * List rules.
     */
    list(): Array<{ id: string; name: string; enabled: boolean; priority: number }> {
        return this.rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled, priority: r.priority }));
    }

    /** Count */
    count(): number { return this.rules.length; }

    // === Private ===

    private isRateLimited(userId: string, ruleId: string, limit: number, windowMs: number): boolean {
        if (!this.userCounts.has(userId)) this.userCounts.set(userId, new Map());
        const userMap = this.userCounts.get(userId)!;
        const entry = userMap.get(ruleId);
        const now = Date.now();

        if (!entry || now > entry.resetAt) {
            userMap.set(ruleId, { count: 1, resetAt: now + windowMs });
            return false;
        }

        entry.count++;
        return entry.count > limit;
    }
}
