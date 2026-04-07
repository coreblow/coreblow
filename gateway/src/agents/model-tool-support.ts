/**
 * agents/model-tool-support.ts
 * Which models support which tool capabilities.
 */
export type ToolSupport = 'full' | 'partial' | 'none';
const MODEL_TOOL_SUPPORT: Record<string, ToolSupport> = {
    'claude-sonnet-4-20250514': 'full', 'claude-3-5-sonnet-20241022': 'full', 'claude-3-5-haiku-20241022': 'full',
    'gpt-4o': 'full', 'gpt-4o-mini': 'full', 'gpt-4-turbo': 'full', 'o1': 'partial', 'o1-mini': 'partial',
    'gemini-2.0-flash': 'full', 'gemini-2.0-pro': 'full', 'gemini-1.5-pro': 'full',
    'deepseek-chat': 'full', 'deepseek-reasoner': 'partial',
};
export function getModelToolSupport(modelId: string): ToolSupport { return MODEL_TOOL_SUPPORT[modelId] ?? 'none'; }
export function modelSupportsTools(modelId: string): boolean { return getModelToolSupport(modelId) !== 'none'; }
