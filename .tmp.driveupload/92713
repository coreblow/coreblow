/**
 * auto-reply/reply/provider-dispatcher.ts
 * Route reply to the correct AI provider based on model selection.
 * Follows CoreBlow's dispatch-from-config.ts + provider-dispatcher.ts pattern.
 */

import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('reply:provider-dispatch');

// ─── Types ──────────────────────────────────────────────────────

export interface ProviderRoute {
    providerId: string;
    model: string;
    priority: number;
    maxRetries: number;
    timeoutMs: number;
    isAvailable: boolean;
}

export interface DispatchResult {
    providerId: string;
    model: string;
    response: string;
    tokensUsed: { prompt: number; completion: number; total: number };
    latencyMs: number;
    fromFallback: boolean;
}

export interface ProviderHealth {
    providerId: string;
    isHealthy: boolean;
    lastErrorAt: number | null;
    errorCount: number;
    avgLatencyMs: number;
}

// ─── Provider Dispatcher ────────────────────────────────────────

export class ProviderDispatcher {
    private health = new Map<string, ProviderHealth>();
    private routes: ProviderRoute[] = [];

    /** Configure provider routes from config. */
    configureRoutes(routes: ProviderRoute[]): void {
        this.routes = routes.sort((a, b) => b.priority - a.priority);
        for (const route of routes) {
            if (!this.health.has(route.providerId)) {
                this.health.set(route.providerId, {
                    providerId: route.providerId,
                    isHealthy: true,
                    lastErrorAt: null,
                    errorCount: 0,
                    avgLatencyMs: 0,
                });
            }
        }
        log.info({ routes: routes.length }, 'Provider routes configured');
    }

    /** Dispatch a chat completion request to the best available provider. */
    async dispatch(
        messages: Array<{ role: string; content: string }>,
        options: {
            model?: string;
            temperature?: number;
            maxTokens?: number;
            tools?: unknown[];
        },
        generateFn: (providerId: string, model: string, messages: unknown[], opts: unknown) => Promise<{
            content: string;
            usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
        }>,
    ): Promise<DispatchResult> {
        const candidates = this.resolveDispatchOrder(options.model);
        if (candidates.length === 0) {
            throw new Error('No providers available for dispatch');
        }

        let lastError: Error | null = null;
        for (let i = 0; i < candidates.length; i++) {
            const route = candidates[i];
            const startTime = Date.now();
            try {
                const result = await generateFn(route.providerId, route.model, messages, options);
                const latencyMs = Date.now() - startTime;

                this.recordSuccess(route.providerId, latencyMs);

                return {
                    providerId: route.providerId,
                    model: route.model,
                    response: result.content,
                    tokensUsed: {
                        prompt: result.usage.prompt_tokens,
                        completion: result.usage.completion_tokens,
                        total: result.usage.total_tokens,
                    },
                    latencyMs,
                    fromFallback: i > 0,
                };
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                this.recordError(route.providerId, lastError);
                log.warn({ provider: route.providerId, error: lastError.message, attempt: i + 1 }, 'Provider failed, trying next');
            }
        }

        throw lastError ?? new Error('All providers exhausted');
    }

    /** Resolve dispatch order: explicit model → healthy high-priority → fallback. */
    resolveDispatchOrder(preferredModel?: string): ProviderRoute[] {
        const available = this.routes.filter(r => r.isAvailable);
        if (preferredModel) {
            const explicit = available.filter(r => r.model === preferredModel || r.providerId === preferredModel);
            const rest = available.filter(r => r.model !== preferredModel && r.providerId !== preferredModel);
            return [...explicit, ...rest].filter(r => this.isHealthy(r.providerId));
        }
        return available.filter(r => this.isHealthy(r.providerId));
    }

    /** Check if provider is healthy (not rate-limited or erroring). */
    isHealthy(providerId: string): boolean {
        const h = this.health.get(providerId);
        if (!h) return true;
        if (!h.isHealthy && h.lastErrorAt) {
            // Auto-recover after 60s cooldown
            if (Date.now() - h.lastErrorAt > 60_000) {
                h.isHealthy = true;
                h.errorCount = 0;
            }
        }
        return h.isHealthy;
    }

    private recordSuccess(providerId: string, latencyMs: number): void {
        const h = this.health.get(providerId);
        if (!h) return;
        h.isHealthy = true;
        h.errorCount = 0;
        h.avgLatencyMs = h.avgLatencyMs === 0 ? latencyMs : (h.avgLatencyMs * 0.8 + latencyMs * 0.2);
    }

    private recordError(providerId: string, error: Error): void {
        const h = this.health.get(providerId);
        if (!h) return;
        h.errorCount++;
        h.lastErrorAt = Date.now();
        if (h.errorCount >= 3) h.isHealthy = false;
        log.error({ providerId, errorCount: h.errorCount }, 'Provider error recorded');
    }

    /** Get health status for all providers. */
    getHealthReport(): ProviderHealth[] {
        return Array.from(this.health.values());
    }

    get routeCount(): number { return this.routes.length; }
}
