/**
 * CoreBlow — Provider Registry
 *
 * Central registry for AI model providers. Handles provider
 * discovery, model-to-provider routing, fallback chains,
 * and health-based provider selection.
 */

import type { ModelProvider } from '../agents/runtime.js';

/** Provider registration entry */
export interface ProviderEntry {
    provider: ModelProvider;
    models: string[];
    priority: number;
    enabled: boolean;
    healthy: boolean;
}

/** Model routing result */
export interface ModelRoute {
    provider: ModelProvider;
    model: string;
    fallbacks: ModelProvider[];
}

/**
 * CoreBlow Provider Registry
 */
export class ProviderRegistry {
    private providers = new Map<string, ProviderEntry>();
    private modelIndex = new Map<string, string[]>(); // model → provider IDs
    private defaultProviderId: string | null = null;

    /**
     * Register a provider with its supported models.
     */
    register(provider: ModelProvider, models: string[], priority: number = 0): void {
        this.providers.set(provider.id, {
            provider,
            models,
            priority,
            enabled: true,
            healthy: true,
        });

        // Index models
        for (const model of models) {
            const providerIds = this.modelIndex.get(model) ?? [];
            providerIds.push(provider.id);
            this.modelIndex.set(model, providerIds);
        }

        // Set default
        if (!this.defaultProviderId) {
            this.defaultProviderId = provider.id;
        }
    }

    /**
     * Route a model to its provider.
     */
    route(model: string): ModelRoute | null {
        // Direct model match
        const providerIds = this.modelIndex.get(model);
        if (providerIds && providerIds.length > 0) {
            // Pick the highest-priority, enabled, healthy provider
            const sorted = providerIds
                .map((id) => this.providers.get(id))
                .filter((e): e is ProviderEntry => !!e && e.enabled && e.healthy)
                .sort((a, b) => b.priority - a.priority);

            if (sorted.length > 0) {
                return {
                    provider: sorted[0]!.provider,
                    model,
                    fallbacks: sorted.slice(1).map((e) => e.provider),
                };
            }
        }

        // Prefix match (e.g., "gpt" → openai)
        for (const [registeredModel, ids] of Array.from(this.modelIndex)) {
            if (model.startsWith(registeredModel.split('-')[0]!)) {
                const entry = ids
                    .map((id) => this.providers.get(id))
                    .filter((e): e is ProviderEntry => !!e && e.enabled && e.healthy)
                    .sort((a, b) => b.priority - a.priority)[0];
                if (entry) {
                    return { provider: entry.provider, model, fallbacks: [] };
                }
            }
        }

        // Default provider
        if (this.defaultProviderId) {
            const entry = this.providers.get(this.defaultProviderId);
            if (entry?.enabled && entry.healthy) {
                return { provider: entry.provider, model, fallbacks: [] };
            }
        }

        return null;
    }

    /**
     * Get a provider by ID.
     */
    get(id: string): ModelProvider | null {
        return this.providers.get(id)?.provider ?? null;
    }

    /**
     * Enable/disable a provider.
     */
    setEnabled(id: string, enabled: boolean): boolean {
        const entry = this.providers.get(id);
        if (!entry) return false;
        entry.enabled = enabled;
        return true;
    }

    /**
     * Mark a provider as healthy or unhealthy.
     */
    setHealthy(id: string, healthy: boolean): boolean {
        const entry = this.providers.get(id);
        if (!entry) return false;
        entry.healthy = healthy;
        return true;
    }

    /**
     * List all registered providers.
     */
    list(): Array<{ id: string; name: string; models: string[]; enabled: boolean; healthy: boolean; priority: number }> {
        return Array.from(this.providers.values()).map((e) => ({
            id: e.provider.id,
            name: e.provider.name,
            models: e.models,
            enabled: e.enabled,
            healthy: e.healthy,
            priority: e.priority,
        }));
    }

    /**
     * List all available models across all providers.
     */
    listModels(): Array<{ model: string; providers: string[] }> {
        return Array.from(this.modelIndex.entries()).map(([model, providerIds]) => ({
            model,
            providers: providerIds,
        }));
    }

    /**
     * Set the default provider.
     */
    setDefault(id: string): boolean {
        if (!this.providers.has(id)) return false;
        this.defaultProviderId = id;
        return true;
    }
}
