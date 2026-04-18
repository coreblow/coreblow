/**
 * CoreBlow — Provider Bootstrap
 *
 * Reads coreblow.json and auto-registers the appropriate AI provider
 * into the AgentRuntime. Follows OpenClaw's config-driven provider
 * loading pattern where `agents.defaults.model` determines the provider.
 *
 * @packageDocumentation
 */

import { loadConfig, type CoreBlowConfig } from '../config/config.js';
import { AgentRuntime, type ModelProvider } from '../agents/runtime.js';
import { OpenAIProvider } from '../providers/openai.js';

// ─── Provider ID Detection ──────────────────────────────────────

/** Map of model prefix → provider ID (OpenClaw pattern) */
const MODEL_PROVIDER_MAP: Array<[RegExp, string]> = [
    [/^(gpt-|o1|o3|o4|chatgpt)/i, 'openai'],
    [/^(claude|anthropic)/i, 'anthropic'],
    [/^(gemini|models\/gemini)/i, 'google'],
    [/^(deepseek)/i, 'deepseek'],
    [/^(llama|meta)/i, 'groq'],
    [/^(mistral|mixtral|codestral)/i, 'mistral'],
    [/^(qwen)/i, 'openrouter'],
    [/^(ollama|phi|tinyllama)/i, 'ollama'],
];

/**
 * Detect provider from a model string.
 * Handles both "provider/model" and bare "model" formats.
 */
export function detectProvider(modelRef: string): { provider: string; model: string } {
    // Format: "provider/model" (e.g., "openai/gpt-4o")
    if (modelRef.includes('/')) {
        const [provider, ...rest] = modelRef.split('/');
        return { provider: provider!, model: rest.join('/') };
    }

    // Bare model name — match by prefix
    for (const [pattern, providerId] of MODEL_PROVIDER_MAP) {
        if (pattern.test(modelRef)) {
            return { provider: providerId, model: modelRef };
        }
    }

    // Default to openai
    return { provider: 'openai', model: modelRef };
}

// ─── Config Resolution ──────────────────────────────────────────

/**
 * Resolve the model reference from CoreBlow config.
 * Following OpenClaw's format: agents.defaults.model can be a string or object.
 */
export function resolveModelFromConfig(config: CoreBlowConfig): { provider: string; model: string } {
    const agentModel = config.agents?.defaults?.model;

    if (!agentModel) {
        return { provider: 'openai', model: 'gpt-4o' };
    }

    if (typeof agentModel === 'string') {
        return detectProvider(agentModel);
    }

    // Object format: { primary: "provider/model" }
    if (typeof agentModel === 'object' && agentModel.primary) {
        return detectProvider(agentModel.primary);
    }

    return { provider: 'openai', model: 'gpt-4o' };
}

// ─── API Key Resolution ─────────────────────────────────────────

/**
 * Resolve the API key for a provider.
 * Follows OpenClaw's env var naming convention.
 */
export function resolveApiKey(providerId: string): string | null {
    const envVarMap: Record<string, string[]> = {
        openai: ['OPENAI_API_KEY'],
        anthropic: ['ANTHROPIC_API_KEY'],
        google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
        deepseek: ['DEEPSEEK_API_KEY'],
        groq: ['GROQ_API_KEY'],
        mistral: ['MISTRAL_API_KEY'],
        openrouter: ['OPENROUTER_API_KEY'],
        ollama: [], // Ollama doesn't need an API key
    };

    const vars = envVarMap[providerId] ?? [`${providerId.toUpperCase()}_API_KEY`];
    for (const envVar of vars) {
        const value = process.env[envVar];
        if (value) return value;
    }

    return null;
}

// ─── Provider Factory ───────────────────────────────────────────

/**
 * Create a ModelProvider instance for the given provider ID.
 */
export function createProvider(providerId: string, apiKey: string, defaultModel: string): ModelProvider {
    // For now, all providers use the OpenAI-compatible API format.
    // OpenClaw does this too — most providers implement OpenAI's chat/completions API.
    switch (providerId) {
        case 'openai':
            return new OpenAIProvider({ apiKey, defaultModel });

        case 'anthropic':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://api.anthropic.com/v1',
                defaultModel: defaultModel || 'claude-sonnet-4-20250514',
            });

        case 'google':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
                defaultModel: defaultModel || 'gemini-2.5-flash',
            });

        case 'deepseek':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://api.deepseek.com/v1',
                defaultModel: defaultModel || 'deepseek-chat',
            });

        case 'groq':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://api.groq.com/openai/v1',
                defaultModel: defaultModel || 'llama-3.3-70b-versatile',
            });

        case 'mistral':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://api.mistral.ai/v1',
                defaultModel: defaultModel || 'mistral-large-latest',
            });

        case 'openrouter':
            return new OpenAIProvider({
                apiKey,
                baseUrl: 'https://openrouter.ai/api/v1',
                defaultModel: defaultModel || 'openai/gpt-4o',
            });

        case 'ollama':
            return new OpenAIProvider({
                apiKey: 'ollama',
                baseUrl: process.env.OLLAMA_HOST ?? 'http://localhost:11434/v1',
                defaultModel: defaultModel || 'llama3.2',
            });

        default:
            // Generic OpenAI-compatible provider
            return new OpenAIProvider({ apiKey, defaultModel });
    }
}

// ─── Main Bootstrap ─────────────────────────────────────────────

export interface BootstrapResult {
    runtime: AgentRuntime;
    provider: string;
    model: string;
    configured: boolean;
}

/**
 * Bootstrap the AgentRuntime from coreblow.json config.
 * Returns a configured runtime ready to accept chat requests.
 */
export function bootstrapRuntime(): BootstrapResult {
    const config = loadConfig();
    const { provider, model } = resolveModelFromConfig(config);
    const apiKey = resolveApiKey(provider);

    const runtime = new AgentRuntime();

    if (!apiKey && provider !== 'ollama') {
        // No API key — runtime won't be functional but gateway still starts
        return { runtime, provider, model, configured: false };
    }

    const providerInstance = createProvider(provider, apiKey ?? '', model);
    runtime.registerProvider(providerInstance, true);

    return { runtime, provider, model, configured: true };
}
