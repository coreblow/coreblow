/**
 * agents/model-catalog.ts
 * Model catalog — registry of available models and capabilities.
 * Ported from OpenClaw src/agents/model-catalog.ts.
 */

export interface ModelCatalogEntry {
    id: string;
    provider: string;
    displayName: string;
    contextWindow: number;
    maxOutputTokens?: number;
    supportsTools: boolean;
    supportsVision: boolean;
    supportsStreaming: boolean;
    supportsThinking?: boolean;
    costPer1kInput?: number;
    costPer1kOutput?: number;
    tags?: string[];
}

const BUILTIN_MODELS: ModelCatalogEntry[] = [
    { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', contextWindow: 128_000, maxOutputTokens: 16_384, supportsTools: true, supportsVision: true, supportsStreaming: true, costPer1kInput: 0.005, costPer1kOutput: 0.015, tags: ['flagship'] },
    { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', contextWindow: 128_000, maxOutputTokens: 16_384, supportsTools: true, supportsVision: true, supportsStreaming: true, costPer1kInput: 0.00015, costPer1kOutput: 0.0006, tags: ['fast', 'cheap'] },
    { id: 'o3', provider: 'openai', displayName: 'o3', contextWindow: 200_000, maxOutputTokens: 100_000, supportsTools: true, supportsVision: true, supportsStreaming: true, supportsThinking: true, tags: ['reasoning'] },
    { id: 'claude-sonnet-4-20250514', provider: 'anthropic', displayName: 'Claude Sonnet 4', contextWindow: 200_000, maxOutputTokens: 64_000, supportsTools: true, supportsVision: true, supportsStreaming: true, supportsThinking: true, costPer1kInput: 0.003, costPer1kOutput: 0.015, tags: ['flagship'] },
    { id: 'claude-opus-4-20250514', provider: 'anthropic', displayName: 'Claude Opus 4', contextWindow: 200_000, maxOutputTokens: 32_000, supportsTools: true, supportsVision: true, supportsStreaming: true, supportsThinking: true, costPer1kInput: 0.015, costPer1kOutput: 0.075, tags: ['flagship', 'premium'] },
    { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', displayName: 'Claude 3.5 Haiku', contextWindow: 200_000, maxOutputTokens: 8_192, supportsTools: true, supportsVision: true, supportsStreaming: true, costPer1kInput: 0.001, costPer1kOutput: 0.005, tags: ['fast', 'cheap'] },
    { id: 'gemini-2.5-pro', provider: 'google', displayName: 'Gemini 2.5 Pro', contextWindow: 1_048_576, maxOutputTokens: 65_536, supportsTools: true, supportsVision: true, supportsStreaming: true, supportsThinking: true, tags: ['flagship', 'long-context'] },
    { id: 'gemini-2.5-flash', provider: 'google', displayName: 'Gemini 2.5 Flash', contextWindow: 1_048_576, maxOutputTokens: 65_536, supportsTools: true, supportsVision: true, supportsStreaming: true, supportsThinking: true, tags: ['fast'] },
    { id: 'deepseek-r1', provider: 'deepseek', displayName: 'DeepSeek R1', contextWindow: 128_000, maxOutputTokens: 8_192, supportsTools: true, supportsVision: false, supportsStreaming: true, supportsThinking: true, tags: ['reasoning', 'cheap'] },
];

export class ModelCatalog {
    private entries = new Map<string, ModelCatalogEntry>();

    constructor() {
        for (const m of BUILTIN_MODELS) this.entries.set(m.id, m);
    }

    get(modelId: string): ModelCatalogEntry | undefined { return this.entries.get(modelId); }

    add(entry: ModelCatalogEntry): void { this.entries.set(entry.id, entry); }

    remove(modelId: string): boolean { return this.entries.delete(modelId); }

    list(): ModelCatalogEntry[] { return [...this.entries.values()]; }

    listByProvider(provider: string): ModelCatalogEntry[] {
        return this.list().filter((m) => m.provider === provider);
    }

    listByTag(tag: string): ModelCatalogEntry[] {
        return this.list().filter((m) => m.tags?.includes(tag));
    }

    findByCapability(caps: { tools?: boolean; vision?: boolean; thinking?: boolean }): ModelCatalogEntry[] {
        return this.list().filter((m) => {
            if (caps.tools && !m.supportsTools) return false;
            if (caps.vision && !m.supportsVision) return false;
            if (caps.thinking && !m.supportsThinking) return false;
            return true;
        });
    }

    resolveContextWindow(modelId: string): number {
        return this.entries.get(modelId)?.contextWindow ?? 128_000;
    }

    estimateCost(modelId: string, inputTokens: number, outputTokens: number): number | null {
        const m = this.entries.get(modelId);
        if (!m?.costPer1kInput || !m?.costPer1kOutput) return null;
        return (inputTokens / 1000) * m.costPer1kInput + (outputTokens / 1000) * m.costPer1kOutput;
    }

    providers(): string[] {
        return [...new Set(this.list().map((m) => m.provider))].sort();
    }

    size(): number { return this.entries.size; }
}
