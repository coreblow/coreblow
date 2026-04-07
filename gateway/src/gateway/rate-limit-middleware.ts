/**
 * CoreBlow — Rate Limit Middleware
 *
 * Gateway middleware that integrates the advanced rate limiter
 * with the middleware composer. Provides per-route, per-user,
 * and global rate limiting with proper HTTP headers.
 */

import type { MiddlewareContext, NextFn } from './middleware.js';

/** Rate limit rule */
export interface RateLimitRule {
    /** Route pattern (glob-like) */
    pattern: string;
    /** Max requests */
    limit: number;
    /** Window in ms */
    windowMs: number;
    /** Key extractor */
    keyBy?: 'ip' | 'user' | 'global';
    /** Skip condition */
    skip?: (ctx: MiddlewareContext) => boolean;
}

/** In-memory rate tracking */
interface RateEntry {
    count: number;
    resetAt: number;
}

/**
 * CoreBlow Rate Limit Middleware
 */
export class RateLimitMiddleware {
    private rules: RateLimitRule[] = [];
    private store = new Map<string, RateEntry>();
    private cleanupTimer: ReturnType<typeof setInterval>;

    constructor(rules?: RateLimitRule[]) {
        if (rules) this.rules = rules;
        this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    }

    /**
     * Add a rate limit rule.
     */
    addRule(rule: RateLimitRule): void {
        this.rules.push(rule);
    }

    /**
     * Get the middleware function.
     */
    middleware(): (ctx: MiddlewareContext, next: NextFn) => Promise<void> {
        return async (ctx, next) => {
            const rule = this.matchRule(ctx.path);
            if (!rule || (rule.skip && rule.skip(ctx))) {
                await next();
                return;
            }

            const key = this.extractKey(ctx, rule);
            const entry = this.getOrCreate(key, rule);
            const now = Date.now();

            // Reset if window expired
            if (now > entry.resetAt) {
                entry.count = 0;
                entry.resetAt = now + rule.windowMs;
            }

            entry.count++;

            // Set headers
            const remaining = Math.max(0, rule.limit - entry.count);
            ctx.response.headers['X-RateLimit-Limit'] = String(rule.limit);
            ctx.response.headers['X-RateLimit-Remaining'] = String(remaining);
            ctx.response.headers['X-RateLimit-Reset'] = String(Math.ceil(entry.resetAt / 1000));

            if (entry.count > rule.limit) {
                const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
                ctx.response.status = 429;
                ctx.response.headers['Retry-After'] = String(retryAfter);
                ctx.response.body = { error: 'Too Many Requests', retryAfter };
                return;
            }

            await next();
        };
    }

    /**
     * Get current rate for a key.
     */
    getRate(key: string): { count: number; remaining: number; resetAt: number } | null {
        const entry = this.store.get(key);
        if (!entry) return null;
        const rule = this.rules[0];
        return {
            count: entry.count,
            remaining: rule ? Math.max(0, rule.limit - entry.count) : 0,
            resetAt: entry.resetAt,
        };
    }

    /**
     * Stop the cleanup timer.
     */
    destroy(): void {
        clearInterval(this.cleanupTimer);
    }

    // === Private ===

    private matchRule(path: string): RateLimitRule | null {
        for (const rule of this.rules) {
            if (rule.pattern === '*' || path.startsWith(rule.pattern) || path === rule.pattern) {
                return rule;
            }
        }
        return null;
    }

    private extractKey(ctx: MiddlewareContext, rule: RateLimitRule): string {
        const keyBy = rule.keyBy ?? 'ip';
        switch (keyBy) {
            case 'ip': return `ip:${ctx.headers['x-forwarded-for'] ?? 'unknown'}:${rule.pattern}`;
            case 'user': return `user:${ctx.state['userId'] ?? 'anon'}:${rule.pattern}`;
            case 'global': return `global:${rule.pattern}`;
            default: return `default:${rule.pattern}`;
        }
    }

    private getOrCreate(key: string, rule: RateLimitRule): RateEntry {
        let entry = this.store.get(key);
        if (!entry) {
            entry = { count: 0, resetAt: Date.now() + rule.windowMs };
            this.store.set(key, entry);
        }
        return entry;
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of Array.from(this.store)) {
            if (now > entry.resetAt) this.store.delete(key);
        }
    }
}
