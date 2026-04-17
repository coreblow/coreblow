/**
 * Discord Welcome Embed — Shown when bot joins a server or user joins.
 */
export function createWelcomeEmbed(botName: string, prefix: string, features: string[]): Record<string, unknown> {
    return { title: `👋 Welcome to ${botName}!`, description: `Use \`${prefix}help\` to see available commands.`, color: 0x57F287,
        fields: [{ name: '✨ Features', value: features.map((f) => `• ${f}`).join('\n') || 'No features listed' },
                 { name: '🔧 Prefix', value: `\`${prefix}\``, inline: true }],
        timestamp: new Date().toISOString() };
}

export function createGoodbyeEmbed(username: string): Record<string, unknown> {
    return { title: '👋 Goodbye!', description: `**${username}** has left the server.`, color: 0xED4245, timestamp: new Date().toISOString() };
}
