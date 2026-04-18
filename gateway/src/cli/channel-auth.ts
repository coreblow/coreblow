/**
 * cli/channel-auth.ts
 * Interactive channel authentication wizard.
 * Ported from CoreBlow src/cli/channel-auth.ts.
 */

import { CHANNEL_IDS, type ChannelId } from '../config/allowed-values.js';

export interface ChannelAuthResult {
    channel: ChannelId;
    credentials: Record<string, string>;
    testPassed: boolean;
}

export interface ChannelAuthField {
    name: string;
    label: string;
    envVar: string;
    sensitive: boolean;
    required: boolean;
    hint?: string;
}

const CHANNEL_AUTH_FIELDS: Record<string, ChannelAuthField[]> = {
    discord: [
        { name: 'token', label: 'Bot Token', envVar: 'DISCORD_TOKEN', sensitive: true, required: true, hint: 'From Discord Developer Portal → Bot → Token' },
        { name: 'applicationId', label: 'Application ID', envVar: 'DISCORD_APP_ID', sensitive: false, required: false },
    ],
    telegram: [
        { name: 'token', label: 'Bot Token', envVar: 'TELEGRAM_BOT_TOKEN', sensitive: true, required: true, hint: 'From @BotFather' },
    ],
    slack: [
        { name: 'token', label: 'Bot Token', envVar: 'SLACK_BOT_TOKEN', sensitive: true, required: true },
        { name: 'signingSecret', label: 'Signing Secret', envVar: 'SLACK_SIGNING_SECRET', sensitive: true, required: true },
        { name: 'appToken', label: 'App Token', envVar: 'SLACK_APP_TOKEN', sensitive: true, required: false, hint: 'Required for Socket Mode' },
    ],
    signal: [
        { name: 'phoneNumber', label: 'Phone Number', envVar: 'SIGNAL_PHONE_NUMBER', sensitive: false, required: true },
        { name: 'password', label: 'REST API Password', envVar: 'SIGNAL_PASSWORD', sensitive: true, required: true },
    ],
    gmail: [
        { name: 'address', label: 'Email Address', envVar: 'GMAIL_ADDRESS', sensitive: false, required: true },
        { name: 'appPassword', label: 'App Password', envVar: 'GMAIL_APP_PASSWORD', sensitive: true, required: true, hint: 'Generate at myaccount.google.com → Security → App Passwords' },
    ],
    whatsapp: [
        { name: 'token', label: 'API Token', envVar: 'WHATSAPP_TOKEN', sensitive: true, required: true },
        { name: 'phoneNumberId', label: 'Phone Number ID', envVar: 'WHATSAPP_PHONE_NUMBER_ID', sensitive: false, required: true },
    ],
    imessage: [
        { name: 'accountId', label: 'Account ID', envVar: 'IMESSAGE_ACCOUNT_ID', sensitive: false, required: true },
    ],
};

/**
 * Get required auth fields for a channel.
 */
export function getChannelAuthFields(channel: string): ChannelAuthField[] {
    return CHANNEL_AUTH_FIELDS[channel] ?? [];
}

/**
 * Check if channel auth is configured.
 */
export function isChannelAuthConfigured(channel: string, env: NodeJS.ProcessEnv = process.env): boolean {
    const fields = getChannelAuthFields(channel);
    return fields.filter((f) => f.required).every((f) => env[f.envVar] !== undefined);
}

/**
 * Get missing required auth fields.
 */
export function getMissingAuthFields(channel: string, env: NodeJS.ProcessEnv = process.env): ChannelAuthField[] {
    return getChannelAuthFields(channel).filter((f) => f.required && env[f.envVar] === undefined);
}

/**
 * Format auth status for display.
 */
export function formatChannelAuthStatus(env: NodeJS.ProcessEnv = process.env): string {
    const lines: string[] = ['Channel Authentication Status:', ''];
    for (const channel of CHANNEL_IDS) {
        const fields = getChannelAuthFields(channel);
        if (fields.length === 0) continue;
        const configured = isChannelAuthConfigured(channel, env);
        const icon = configured ? '✅' : '❌';
        lines.push(`  ${icon} ${channel}`);
        for (const field of fields) {
            const set = env[field.envVar] !== undefined;
            const fIcon = set ? '  ✓' : '  ✗';
            lines.push(`     ${fIcon} ${field.label} (${field.envVar})`);
        }
    }
    return lines.join('\n');
}
