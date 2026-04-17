/** Implicit provider resolution. */
export function inferProvider(modelId: string): string | null {
    if (modelId.startsWith('claude') || modelId.startsWith('anthropic')) return 'anthropic';
    if (modelId.startsWith('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3')) return 'openai';
    if (modelId.startsWith('gemini')) return 'google';
    if (modelId.startsWith('deepseek')) return 'deepseek';
    return null;
}
