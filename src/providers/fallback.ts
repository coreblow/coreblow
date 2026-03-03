/**
 * src/providers/fallback.ts
 * Auto-Fallback Chain — cross-provider failover
 * SUPERIOR TO CoreBlow: CoreBlow only rotates keys within same provider
 * CoreBlow rotates across DIFFERENT providers
 */

import { createChildLogger } from '../utils/logger.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';

const log = createChildLogger('provider:fallback');

export interface ProviderHealth {
    name: string;
    provider: AIProvider;
    healthy: boolean;
    lastError?: string;
    lastErrorAt?: number;
    cooldownUntil: number;
    totalErrors: number;
    totalSuccess: number;
    avgLatencyMs: number;
}

export class FallbackProvider implements AIProvider {
    name = 'fallback';
    private chain: ProviderHealth[] = [];
    private cooldownMs: number;
    private maxRetries: number;

    constructor(providers: AIProvider[], opts: {
        cooldownMs?: number;
        maxRetries?: number;
    } = {}) {
        this.cooldownMs = opts.cooldownMs || 60_000; // 1 min cooldown after error
        this.maxRetries = opts.maxRetries || 3;

        this.chain = providers.map(p => ({
            name: p.name,
            provider: p,
            healthy: true,
            cooldownUntil: 0,
            totalErrors: 0,
            totalSuccess: 0,
            avgLatencyMs: 0,
        }));

        log.info({ chain: providers.map(p => p.name) }, 'Fallback chain initialized');
    }

    async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
        let lastError = '';

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const provider = this.selectProvider();
            if (!provider) {
                yield { type: 'error', error: `All providers down. Last: ${lastError}` };
                return;
            }

            const startTime = Date.now();
            log.debug({ provider: provider.name, attempt }, 'Trying provider');

            try {
                let hasOutput = false;
                const result = provider.provider.chat(messages, options);
                const iterable = Symbol.asyncIterator in Object(result)
                    ? result as AsyncIterable<StreamChunk>
                    : async function* () { yield* [] as StreamChunk[]; }();
                for await (const chunk of iterable) {
                    if (chunk.type === 'error') {
                        throw new Error(chunk.error || 'Unknown error');
                    }
                    hasOutput = true;
                    yield chunk;
                }

                if (hasOutput) {
                    const latency = Date.now() - startTime;
                    this.markSuccess(provider, latency);
                    return; // Success — exit
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                lastError = `${provider.name}: ${msg}`;
                log.warn({ provider: provider.name, err: msg, attempt }, 'Provider failed, trying next');
                this.markFailure(provider, msg);
                continue; // Try next provider
            }
        }

        yield { type: 'error', error: `Exhausted ${this.maxRetries} retries. Last: ${lastError}` };
    }

    private selectProvider(): ProviderHealth | null {
        const now = Date.now();
        // Sort by: healthy first, then by lowest error rate
        const available = this.chain
            .filter(p => p.cooldownUntil < now)
            .sort((a, b) => {
                if (a.healthy !== b.healthy) return a.healthy ? -1 : 1;
                const aRate = a.totalErrors / Math.max(a.totalSuccess + a.totalErrors, 1);
                const bRate = b.totalErrors / Math.max(b.totalSuccess + b.totalErrors, 1);
                return aRate - bRate;
            });

        return available[0] || null;
    }

    private markSuccess(p: ProviderHealth, latencyMs: number) {
        p.healthy = true;
        p.totalSuccess++;
        p.avgLatencyMs = (p.avgLatencyMs * (p.totalSuccess - 1) + latencyMs) / p.totalSuccess;
    }

    private markFailure(p: ProviderHealth, error: string) {
        p.totalErrors++;
        p.lastError = error;
        p.lastErrorAt = Date.now();

        // Escalating cooldown: 1min, 2min, 4min, max 15min
        const escalation = Math.min(Math.pow(2, Math.min(p.totalErrors - 1, 4)), 15);
        p.cooldownUntil = Date.now() + this.cooldownMs * escalation;

        if (p.totalErrors >= 3) p.healthy = false;

        log.warn({
            provider: p.name,
            errors: p.totalErrors,
            cooldownMin: escalation,
        }, 'Provider marked with cooldown');
    }

    getHealthStatus(): ProviderHealth[] {
        return this.chain.map(p => ({ ...p }));
    }

    resetAll() {
        for (const p of this.chain) {
            p.healthy = true;
            p.totalErrors = 0;
            p.totalSuccess = 0;
            p.cooldownUntil = 0;
        }
    }

    async isAvailable(): Promise<boolean> {
        for (const p of this.chain) {
            if (await p.provider.isAvailable()) return true;
        }
        return false;
    }

    async listModels(): Promise<string[]> {
        const models: string[] = [];
        for (const p of this.chain) {
            const m = await Promise.resolve(p.provider.listModels());
            models.push(...m.map((name: string) => `${p.name}/${name}`));
        }
        return models;
    }
}
