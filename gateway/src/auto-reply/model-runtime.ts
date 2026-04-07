/**
 * auto-reply/model-runtime.ts
 * Model selection engine with fallback chains and token budget enforcement.
 * Ported from OpenClaw src/auto-reply/model-runtime.ts.
 */

export interface ModelConfig {
    provider: string;
    modelId: string;
    maxContextTokens?: number;
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
}

export interface ModelFallbackChain {
    primary: ModelConfig;
    fallbacks: ModelConfig[];
}

/**
 * Parse a model string into provider + model ID.
 * Supports: "openai/gpt-4o", "anthropic/claude-3.5-sonnet", "gpt-4o" (infer provider)
 */
export function parseModelString(model: string): { provider: string; modelId: string } {
    const trimmed = model.trim();
    const slashIndex = trimmed.indexOf('/');
    if (slashIndex > 0) {
        return { provider: trimmed.slice(0, slashIndex), modelId: trimmed.slice(slashIndex + 1) };
    }
    // Infer provider from model name
    return { provider: inferProvider(trimmed), modelId: trimmed };
}

function inferProvider(modelId: string): string {
    const m = modelId.toLowerCase();
    if (m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
    if (m.startsWith('claude-')) return 'anthropic';
    if (m.startsWith('gemini-')) return 'google';
    if (m.startsWith('llama') || m.startsWith('mixtral') || m.startsWith('mistral')) return 'groq';
    if (m.startsWith('deepseek')) return 'deepseek';
    if (m.startsWith('command')) return 'cohere';
    return 'openai'; // default fallback
}

/**
 * Resolve the model configuration from config.
 */
export function resolveModelConfig(cfg: Record<string, unknown>, agentName?: string): ModelConfig | null {
    const agents = cfg.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;

    // Check agent-specific model first
    if (agentName) {
        const agentList = agents as Record<string, unknown> | undefined;
        const agent = agentList?.[agentName] as Record<string, unknown> | undefined;
        if (typeof agent?.model === 'string') {
            const parsed = parseModelString(agent.model);
            return { ...parsed, maxContextTokens: agent.maxContextTokens as number | undefined };
        }
    }

    // Fall back to default
    if (typeof defaults?.model === 'string') {
        const parsed = parseModelString(defaults.model);
        return { ...parsed, maxContextTokens: defaults.maxContextTokens as number | undefined };
    }

    return null;
}

/**
 * Build a fallback chain from config.
 */
export function resolveModelFallbackChain(cfg: Record<string, unknown>, agentName?: string): ModelFallbackChain | null {
    const primary = resolveModelConfig(cfg, agentName);
    if (!primary) return null;

    const agents = cfg.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const fallbackModels = defaults?.fallbackModels;

    const fallbacks: ModelConfig[] = [];
    if (Array.isArray(fallbackModels)) {
        for (const model of fallbackModels) {
            if (typeof model === 'string') {
                fallbacks.push(parseModelString(model));
            }
        }
    }

    return { primary, fallbacks };
}

/**
 * Estimate token count for a text (rough approximation).
 * ~4 characters per token for English text.
 */
export function estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Truncate context to fit within token budget.
 */
export function truncateContextToFit(messages: Array<{ role: string; content: string }>, maxTokens: number): Array<{ role: string; content: string }> {
    let totalTokens = 0;
    const result: Array<{ role: string; content: string }> = [];

    // Always keep system message (first) and latest user message (last)
    const system = messages.find((m) => m.role === 'system');
    const latest = messages[messages.length - 1];

    if (system) {
        totalTokens += estimateTokenCount(system.content);
        result.push(system);
    }

    // Add messages from the end until budget is reached
    const middle = messages.filter((m) => m !== system && m !== latest);
    const reversed = [...middle].reverse();

    const toAdd: Array<{ role: string; content: string }> = [];
    for (const msg of reversed) {
        const tokens = estimateTokenCount(msg.content);
        if (totalTokens + tokens + (latest ? estimateTokenCount(latest.content) : 0) > maxTokens) break;
        totalTokens += tokens;
        toAdd.unshift(msg);
    }

    result.push(...toAdd);
    if (latest && latest !== system) result.push(latest);

    return result;
}
