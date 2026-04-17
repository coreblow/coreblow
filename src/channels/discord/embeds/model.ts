/**
 * Discord Model Embed — Shows current AI model information.
 */
export function createModelEmbed(model: string, provider: string, contextWindow?: number, description?: string): Record<string, unknown> {
    return { title: `🤖 Model: ${model}`, description: description ?? `Provider: **${provider}**`, color: 0x5865F2, fields: [
        { name: 'Provider', value: provider, inline: true },
        { name: 'Context Window', value: contextWindow ? `${contextWindow.toLocaleString()} tokens` : 'Unknown', inline: true },
    ], timestamp: new Date().toISOString() };
}
