/**
 * auto-reply/reply/commands-acp/runtime-options.ts
 * Runtime options for ACP sessions.
 */

export interface ACPRuntimeOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    tools?: string[];
    systemPrompt?: string;
    timeout?: number;
    maxIterations?: number;
    sandbox?: boolean;
}

const MODEL_CAPABILITIES: Record<string, { maxTokens: number; supportsTools: boolean; supportsVision: boolean }> = {
    'gpt-4o': { maxTokens: 128000, supportsTools: true, supportsVision: true },
    'gpt-4o-mini': { maxTokens: 128000, supportsTools: true, supportsVision: true },
    'claude-3-5-sonnet': { maxTokens: 200000, supportsTools: true, supportsVision: true },
    'claude-3-haiku': { maxTokens: 200000, supportsTools: true, supportsVision: true },
    'gemini-2.0-flash': { maxTokens: 1000000, supportsTools: true, supportsVision: true },
};

/** Validate runtime options against agent capabilities. */
export function validateRuntimeOptions(opts: ACPRuntimeOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (opts.temperature !== undefined && (opts.temperature < 0 || opts.temperature > 2)) errors.push('temperature must be 0-2');
    if (opts.maxTokens !== undefined && opts.maxTokens < 1) errors.push('maxTokens must be positive');
    if (opts.maxIterations !== undefined && (opts.maxIterations < 1 || opts.maxIterations > 100)) errors.push('maxIterations must be 1-100');
    if (opts.timeout !== undefined && (opts.timeout < 1000 || opts.timeout > 600_000)) errors.push('timeout must be 1s-10min');

    if (opts.model && opts.tools?.length) {
        const caps = MODEL_CAPABILITIES[opts.model];
        if (caps && !caps.supportsTools) errors.push(`Model ${opts.model} does not support tools`);
    }

    if (opts.model && opts.maxTokens) {
        const caps = MODEL_CAPABILITIES[opts.model];
        if (caps && opts.maxTokens > caps.maxTokens) errors.push(`maxTokens exceeds ${opts.model} limit of ${caps.maxTokens}`);
    }

    return { valid: errors.length === 0, errors };
}

/** Merge user options with defaults. */
export function mergeWithDefaults(opts: Partial<ACPRuntimeOptions>): ACPRuntimeOptions {
    return { model: opts.model ?? 'gpt-4o', maxTokens: opts.maxTokens ?? 4096, temperature: opts.temperature ?? 0.7, tools: opts.tools ?? [], systemPrompt: opts.systemPrompt ?? '', timeout: opts.timeout ?? 120_000, maxIterations: opts.maxIterations ?? 25, sandbox: opts.sandbox ?? false };
}

/** Parse runtime options from command args. */
export function parseRuntimeOptions(args: string[]): Partial<ACPRuntimeOptions> {
    const opts: Partial<ACPRuntimeOptions> = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i], next = args[i + 1];
        if (arg === '--model' && next) { opts.model = next; i++; }
        else if (arg === '--max-tokens' && next) { opts.maxTokens = parseInt(next); i++; }
        else if (arg === '--temp' && next) { opts.temperature = parseFloat(next); i++; }
        else if (arg === '--timeout' && next) { opts.timeout = parseInt(next) * 1000; i++; }
        else if (arg === '--sandbox') opts.sandbox = true;
        else if (arg === '--tool' && next) { (opts.tools ??= []).push(next); i++; }
    }
    return opts;
}
