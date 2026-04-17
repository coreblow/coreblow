/**
 * agents/prompt-composition.ts
 * Compose final prompt from system + persona + context + tools + user.
 */

export interface PromptBudget { maxTokens: number; systemBudget: number; contextBudget: number; toolsBudget: number }

export interface ComposedPrompt { system: string; messages: Array<{ role: string; content: string }>; estimatedTokens: number; truncated: boolean }

const AVG_CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number { return Math.ceil(text.length / AVG_CHARS_PER_TOKEN); }

export function composePrompt(opts: {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    budget: PromptBudget;
}): ComposedPrompt {
    let truncated = false;
    let system = opts.systemPrompt;
    if (estimateTokens(system) > opts.budget.systemBudget) {
        system = system.slice(0, opts.budget.systemBudget * AVG_CHARS_PER_TOKEN);
        truncated = true;
    }

    const contextBudgetChars = opts.budget.contextBudget * AVG_CHARS_PER_TOKEN;
    let totalContextChars = 0;
    const messages: Array<{ role: string; content: string }> = [];

    // Keep messages from most recent, working backwards
    for (let i = opts.messages.length - 1; i >= 0; i--) {
        const msg = opts.messages[i];
        const msgChars = msg.content.length;
        if (totalContextChars + msgChars > contextBudgetChars) { truncated = true; break; }
        messages.unshift(msg);
        totalContextChars += msgChars;
    }

    const estimatedTokens = estimateTokens(system) + messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    return { system, messages, estimatedTokens, truncated };
}

export function createDefaultBudget(maxContextTokens: number): PromptBudget {
    return {
        maxTokens: maxContextTokens,
        systemBudget: Math.floor(maxContextTokens * 0.15),
        contextBudget: Math.floor(maxContextTokens * 0.7),
        toolsBudget: Math.floor(maxContextTokens * 0.15),
    };
}
