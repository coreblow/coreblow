/**
 * Discord Info Embed — General information display.
 */
export function createInfoEmbed(title: string, description: string, fields?: Array<{ name: string; value: string; inline?: boolean }>): Record<string, unknown> {
    return { title: `ℹ️ ${title}`, description, color: 0x5865F2, fields: fields ?? [], timestamp: new Date().toISOString() };
}

export function createSuccessEmbed(title: string, description: string): Record<string, unknown> {
    return { title: `✅ ${title}`, description, color: 0x57F287, timestamp: new Date().toISOString() };
}