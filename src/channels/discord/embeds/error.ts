/**
 * Discord Error Embed — Standardized error display.
 */
export function createErrorEmbed(title: string, description: string, code?: string): Record<string, unknown> {
    return { title: `❌ ${title}`, description, color: 0xED4245, fields: code ? [{ name: 'Error Code', value: `\`${code}\``, inline: true }] : [], timestamp: new Date().toISOString() };
}

export function createWarningEmbed(title: string, description: string): Record<string, unknown> {
    return { title: `⚠️ ${title}`, description, color: 0xFEE75C, timestamp: new Date().toISOString() };
}
