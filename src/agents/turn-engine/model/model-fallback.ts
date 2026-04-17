/**
 * CoreBlow — Model Fallback Chain (CoreBlow Parity)
 *
 * When a model API fails (rate limit, server error, auth failure),
 * automatically falls back to the next model in the chain.
 *
 * Features:
 *  - Priority-ordered fallback chain
 *  - Per-model cooldown after failure (avoids hammering failed providers)
 *  - Observation tracking (which models succeed/fail over time)
 *  - Model suppression (auto-disable persistently failing models)
 *  - Configurable retry with exponential backoff
 */

// ─── Types ──────────────────────────────────────────────────────

export interface ModelConfig {
    /** Model identifier (e.g., "gpt-4o", "claude-3.5-sonnet") */
    id: string;
    /** Provider (e.g., "openai", "anthropic", "google") */
    provider: string;
    /** Priority (lower = tried first) */
    priority: number;
    /** Maximum tokens for this model */
    maxTokens?: number;
    /** Whether this model supports tool calling */
    supportsTools?: boolean;
    /** Whether this model supports vision */
    supportsVision?: boolean;
    /** Whether this model is currently suppressed */
    suppressed?: boolean;
}

export interface FallbackConfig {
    /** Ordered list of models to try */
    models: ModelConfig[];
    /** Cooldown after failure (ms, default 60000 = 1 min) */
    cooldownMs?: number;
    /** Max consecutive failures before suppression (default 3) */
    maxFailuresBeforeSuppression?: number;
    /** Suppression duration (ms, default 300000 = 5 min) */
    suppressionDurationMs?: number;
    /** Maximum retry attempts per model (default 1) */
    maxRetries?: number;
    /** Base delay for exponential backoff (ms, default 1000) */
    baseRetryDelayMs?: number;
}

export type FailureReason = 'rate_limit' | 'auth_failure' | 'server_error' | 'timeout' | 'model_not_found' | 'unknown';

export interface ModelObservation {
    modelId: string;
    successes: number;
    failures: number;
    lastSuccess?: number;
    lastFailure?: number;
    lastFailureReason?: FailureReason;
    cooldownUntil?: number;
    suppressedUntil?: number;
    avgLatencyMs: number;
    totalLatencyMs: number;
}

export interface FallbackResult<T> {
    /** The result from the successful model */
    result: T;
    /** Which model was used */
    modelId: string;
    /** Number of models tried before success */
    attemptCount: number;
    /** Models that failed and why */
    failures: Array<{ modelId: string; reason: FailureReason; error: string }>;
    /** Latency of the successful call (ms) */
    latencyMs: number;
}

// ─── Error Classification ───────────────────────────────────────

function classifyModelError(err: unknown): FailureReason {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
        return 'rate_limit';
    }
    if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('api key')) {
        return 'auth_failure';
    }
    if (lower.includes('500') || lower.includes('502') || lower.includes('503') || lower.includes('internal server')) {
        return 'server_error';
    }
    if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
        return 'timeout';
    }
    if (lower.includes('404') || lower.includes('not found') || lower.includes('does not exist')) {
        return 'model_not_found';
    }
    return 'unknown';
}

// ─── Model Fallback Chain ───────────────────────────────────────

export class ModelFallbackChain {
    private config: Required<FallbackConfig>;
    private observations: Map<string, ModelObservation> = new Map();

    constructor(config: FallbackConfig) {
        this.config = {
            models: [...config.models].sort((a, b) => a.priority - b.priority),
            cooldownMs: config.cooldownMs ?? 60_000,
            maxFailuresBeforeSuppression: config.maxFailuresBeforeSuppression ?? 3,
            suppressionDurationMs: config.suppressionDurationMs ?? 300_000,
            maxRetries: config.maxRetries ?? 1,
            baseRetryDelayMs: config.baseRetryDelayMs ?? 1000,
        };

        // Initialize observations
        for (const model of this.config.models) {
            this.observations.set(model.id, {
                modelId: model.id,
                successes: 0,
                failures: 0,
                avgLatencyMs: 0,
                totalLatencyMs: 0,
            });
        }
    }

    /**
     * Execute a function with automatic model fallback.
     * Tries each model in priority order, falling back on failure.
     */
    async execute<T>(
        fn: (modelId: string, provider: string) => Promise<T>,
        filter?: { requireTools?: boolean; requireVision?: boolean },
    ): Promise<FallbackResult<T>> {
        const now = Date.now();
        const failures: Array<{ modelId: string; reason: FailureReason; error: string }> = [];
        let attemptCount = 0;

        // Get available models (not in cooldown, not suppressed)
        const availableModels = this.config.models.filter(model => {
            if (model.suppressed) return false;

            const obs = this.observations.get(model.id);
            if (obs?.cooldownUntil && obs.cooldownUntil > now) return false;
            if (obs?.suppressedUntil && obs.suppressedUntil > now) return false;

            // Capability filter
            if (filter?.requireTools && !model.supportsTools) return false;
            if (filter?.requireVision && !model.supportsVision) return false;

            return true;
        });

        if (availableModels.length === 0) {
            // All models unavailable — clear cooldowns and try anyway
            this.clearCooldowns();
            const anyModel = this.config.models[0];
            if (!anyModel) {
                throw new Error('No models configured in fallback chain');
            }
            availableModels.push(anyModel);
        }

        for (const model of availableModels) {
            for (let retry = 0; retry <= this.config.maxRetries; retry++) {
                attemptCount++;

                try {
                    const start = Date.now();
                    const result = await fn(model.id, model.provider);
                    const latencyMs = Date.now() - start;

                    // Record success
                    this.recordSuccess(model.id, latencyMs);

                    return {
                        result,
                        modelId: model.id,
                        attemptCount,
                        failures,
                        latencyMs,
                    };
                } catch (err) {
                    const reason = classifyModelError(err);
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    failures.push({ modelId: model.id, reason, error: errorMsg });

                    // Record failure
                    this.recordFailure(model.id, reason);

                    // Don't retry on auth failure or model not found — move to next model
                    if (reason === 'auth_failure' || reason === 'model_not_found') {
                        break;
                    }

                    // Retry with backoff for transient errors
                    if (retry < this.config.maxRetries) {
                        const delay = this.config.baseRetryDelayMs * Math.pow(2, retry);
                        await sleep(delay);
                    }
                }
            }
        }

        // All models failed
        const lastFailure = failures[failures.length - 1];
        throw new Error(
            `All ${failures.length} model attempts failed. Last error: ${lastFailure?.error ?? 'unknown'}. ` +
            `Models tried: ${failures.map(f => `${f.modelId}(${f.reason})`).join(', ')}`
        );
    }

    // ─── Observation Tracking ───────────────────────────────────

    private recordSuccess(modelId: string, latencyMs: number): void {
        const obs = this.observations.get(modelId);
        if (!obs) return;

        obs.successes++;
        obs.lastSuccess = Date.now();
        obs.totalLatencyMs += latencyMs;
        obs.avgLatencyMs = obs.totalLatencyMs / obs.successes;

        // Clear cooldown on success
        obs.cooldownUntil = undefined;
    }

    private recordFailure(modelId: string, reason: FailureReason): void {
        const obs = this.observations.get(modelId);
        if (!obs) return;

        obs.failures++;
        obs.lastFailure = Date.now();
        obs.lastFailureReason = reason;

        // Apply cooldown
        if (reason === 'rate_limit') {
            obs.cooldownUntil = Date.now() + this.config.cooldownMs;
        } else if (reason === 'server_error') {
            obs.cooldownUntil = Date.now() + this.config.cooldownMs / 2;
        }

        // Check for suppression
        if (obs.failures >= this.config.maxFailuresBeforeSuppression) {
            obs.suppressedUntil = Date.now() + this.config.suppressionDurationMs;
        }
    }

    private clearCooldowns(): void {
        for (const obs of this.observations.values()) {
            obs.cooldownUntil = undefined;
            obs.suppressedUntil = undefined;
        }
    }

    // ─── Query Methods ──────────────────────────────────────────

    /**
     * Get the current best model (first available).
     */
    getBestModel(filter?: { requireTools?: boolean; requireVision?: boolean }): ModelConfig | null {
        const now = Date.now();
        for (const model of this.config.models) {
            if (model.suppressed) continue;
            const obs = this.observations.get(model.id);
            if (obs?.cooldownUntil && obs.cooldownUntil > now) continue;
            if (obs?.suppressedUntil && obs.suppressedUntil > now) continue;
            if (filter?.requireTools && !model.supportsTools) continue;
            if (filter?.requireVision && !model.supportsVision) continue;
            return model;
        }
        return this.config.models[0] ?? null;
    }

    /**
     * Get observations for all models.
     */
    getObservations(): ModelObservation[] {
        return Array.from(this.observations.values());
    }

    /**
     * Get observation for a specific model.
     */
    getModelObservation(modelId: string): ModelObservation | undefined {
        return this.observations.get(modelId);
    }

    /**
     * Manually suppress a model.
     */
    suppressModel(modelId: string, durationMs?: number): void {
        const obs = this.observations.get(modelId);
        if (obs) {
            obs.suppressedUntil = Date.now() + (durationMs ?? this.config.suppressionDurationMs);
        }
    }

    /**
     * Manually unsuppress a model.
     */
    unsuppressModel(modelId: string): void {
        const obs = this.observations.get(modelId);
        if (obs) {
            obs.suppressedUntil = undefined;
            obs.cooldownUntil = undefined;
        }
    }

    /**
     * Get all configured models.
     */
    getModels(): readonly ModelConfig[] {
        return this.config.models;
    }

    /**
     * Get health summary.
     */
    health(): {
        totalModels: number;
        availableModels: number;
        suppressedModels: number;
        coolingDownModels: number;
    } {
        const now = Date.now();
        let available = 0;
        let suppressed = 0;
        let coolingDown = 0;

        for (const model of this.config.models) {
            const obs = this.observations.get(model.id);
            if (model.suppressed || (obs?.suppressedUntil && obs.suppressedUntil > now)) {
                suppressed++;
            } else if (obs?.cooldownUntil && obs.cooldownUntil > now) {
                coolingDown++;
            } else {
                available++;
            }
        }

        return {
            totalModels: this.config.models.length,
            availableModels: available,
            suppressedModels: suppressed,
            coolingDownModels: coolingDown,
        };
    }
}

// ─── Model Catalog ──────────────────────────────────────────────

/**
 * Registry of known models and their capabilities.
 */
export const MODEL_CATALOG: ModelConfig[] = [
    // OpenAI
    { id: 'gpt-4o', provider: 'openai', priority: 10, maxTokens: 128000, supportsTools: true, supportsVision: true },
    { id: 'gpt-4o-mini', provider: 'openai', priority: 15, maxTokens: 128000, supportsTools: true, supportsVision: true },
    { id: 'o4-mini', provider: 'openai', priority: 12, maxTokens: 200000, supportsTools: true, supportsVision: true },
    { id: 'o3', provider: 'openai', priority: 8, maxTokens: 200000, supportsTools: true, supportsVision: true },
    { id: 'o3-mini', provider: 'openai', priority: 11, maxTokens: 128000, supportsTools: true, supportsVision: false },

    // Anthropic
    { id: 'claude-4-opus', provider: 'anthropic', priority: 5, maxTokens: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-4-sonnet', provider: 'anthropic', priority: 7, maxTokens: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-3.5-sonnet', provider: 'anthropic', priority: 9, maxTokens: 200000, supportsTools: true, supportsVision: true },
    { id: 'claude-3.5-haiku', provider: 'anthropic', priority: 14, maxTokens: 200000, supportsTools: true, supportsVision: true },

    // Google
    { id: 'gemini-3.1-pro', provider: 'google', priority: 6, maxTokens: 2000000, supportsTools: true, supportsVision: true },
    { id: 'gemini-2.5-pro', provider: 'google', priority: 8, maxTokens: 1048576, supportsTools: true, supportsVision: true },
    { id: 'gemini-2.5-flash', provider: 'google', priority: 13, maxTokens: 1048576, supportsTools: true, supportsVision: true },

    // Mistral
    { id: 'mistral-large', provider: 'mistral', priority: 16, maxTokens: 128000, supportsTools: true, supportsVision: false },

    // DeepSeek
    { id: 'deepseek-v3', provider: 'deepseek', priority: 17, maxTokens: 128000, supportsTools: true, supportsVision: false },
];

/**
 * Create a fallback chain from provider preferences.
 */
export function createFallbackChain(
    preferredProviders: string[],
    config?: Partial<Omit<FallbackConfig, 'models'>>,
): ModelFallbackChain {
    // Sort models by provider preference, then by priority
    const models = MODEL_CATALOG
        .map(model => {
            const providerIndex = preferredProviders.indexOf(model.provider);
            const adjustedPriority = providerIndex >= 0
                ? model.priority + (providerIndex * 100)
                : model.priority + 1000; // Non-preferred providers go last
            return { ...model, priority: adjustedPriority };
        })
        .sort((a, b) => a.priority - b.priority);

    return new ModelFallbackChain({ models, ...config });
}

// ─── Helper ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
