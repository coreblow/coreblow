/** Claude-specific CLI runner. */
export interface ClaudeCliConfig { apiKey?: string; model?: string; maxTokens?: number; }
export function resolveClaudeCliConfig(env?: Record<string, string | undefined>): ClaudeCliConfig { return { apiKey: env?.ANTHROPIC_API_KEY, model: env?.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514' }; }
