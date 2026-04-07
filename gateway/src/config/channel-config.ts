/**
 * CoreBlow Channel Config & Metadata Validation
 *
 * Validates per-channel configuration, manages channel metadata schemas,
 * and provides channel discovery/registration.
 *
 * Equivalent: CoreBlow config/channel-config-metadata.ts + channel-capabilities.ts + channel-configured.ts (~380 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:channel');

// ─── Types ────────────────────────────────────────────────────────

export interface ChannelConfigSchema {
    channelId: string;
    displayName: string;
    description: string;
    requiredFields: ChannelField[];
    optionalFields: ChannelField[];
    capabilities: ChannelCapability[];
}

export interface ChannelField {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    sensitive?: boolean;
    defaultValue?: unknown;
    validValues?: unknown[];
}

export type ChannelCapability =
    | 'text' | 'images' | 'audio' | 'video' | 'files'
    | 'buttons' | 'reactions' | 'threads' | 'mentions'
    | 'markdown' | 'html' | 'embeds' | 'webhooks'
    | 'streaming' | 'typing-indicator' | 'read-receipts'
    | 'voice' | 'group-chat' | 'direct-message';

export interface ChannelValidationResult {
    valid: boolean;
    channelId: string;
    errors: ChannelValidationError[];
    warnings: string[];
}

export interface ChannelValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning';
}

// ─── Registry ─────────────────────────────────────────────────────

const channelSchemas = new Map<string, ChannelConfigSchema>();

// Register built-in channel schemas
const BUILT_IN_SCHEMAS: ChannelConfigSchema[] = [
    {
        channelId: 'telegram',
        displayName: 'Telegram',
        description: 'Telegram Bot integration',
        requiredFields: [
            { name: 'token', type: 'string', description: 'Bot token from @BotFather', required: true, sensitive: true },
        ],
        optionalFields: [
            { name: 'webhookUrl', type: 'string', description: 'Webhook URL for updates', required: false },
            { name: 'allowedChats', type: 'array', description: 'Allowed chat IDs', required: false, defaultValue: [] },
            { name: 'parseMode', type: 'string', description: 'Message parse mode', required: false, defaultValue: 'MarkdownV2', validValues: ['MarkdownV2', 'HTML', 'Markdown'] },
        ],
        capabilities: ['text', 'images', 'audio', 'files', 'buttons', 'reactions', 'markdown', 'group-chat', 'direct-message', 'typing-indicator'],
    },
    {
        channelId: 'discord',
        displayName: 'Discord',
        description: 'Discord Bot integration',
        requiredFields: [
            { name: 'token', type: 'string', description: 'Bot token from Discord Developer Portal', required: true, sensitive: true },
        ],
        optionalFields: [
            { name: 'applicationId', type: 'string', description: 'Application (client) ID', required: false },
            { name: 'allowedGuilds', type: 'array', description: 'Allowed guild IDs', required: false, defaultValue: [] },
            { name: 'allowedChannels', type: 'array', description: 'Allowed channel IDs', required: false, defaultValue: [] },
        ],
        capabilities: ['text', 'images', 'files', 'embeds', 'reactions', 'threads', 'mentions', 'markdown', 'group-chat', 'direct-message', 'streaming', 'typing-indicator'],
    },
    {
        channelId: 'slack',
        displayName: 'Slack',
        description: 'Slack Bot integration',
        requiredFields: [
            { name: 'botToken', type: 'string', description: 'Bot User OAuth Token', required: true, sensitive: true },
            { name: 'signingSecret', type: 'string', description: 'Signing Secret', required: true, sensitive: true },
        ],
        optionalFields: [
            { name: 'appToken', type: 'string', description: 'App-level token for Socket Mode', required: false, sensitive: true },
            { name: 'allowedChannels', type: 'array', description: 'Allowed channel IDs', required: false, defaultValue: [] },
        ],
        capabilities: ['text', 'images', 'files', 'buttons', 'threads', 'mentions', 'markdown', 'reactions', 'group-chat', 'direct-message', 'typing-indicator'],
    },
    {
        channelId: 'whatsapp',
        displayName: 'WhatsApp',
        description: 'WhatsApp Business API integration',
        requiredFields: [
            { name: 'phoneNumberId', type: 'string', description: 'Phone number ID', required: true },
            { name: 'accessToken', type: 'string', description: 'Access token', required: true, sensitive: true },
        ],
        optionalFields: [
            { name: 'verifyToken', type: 'string', description: 'Webhook verify token', required: false },
            { name: 'webhookUrl', type: 'string', description: 'Webhook URL', required: false },
        ],
        capabilities: ['text', 'images', 'audio', 'video', 'files', 'buttons', 'reactions', 'direct-message', 'read-receipts'],
    },
    {
        channelId: 'web',
        displayName: 'Web Chat',
        description: 'Built-in web chat interface',
        requiredFields: [],
        optionalFields: [
            { name: 'port', type: 'number', description: 'Web server port', required: false, defaultValue: 3000 },
            { name: 'cors', type: 'object', description: 'CORS configuration', required: false },
            { name: 'theme', type: 'string', description: 'UI theme', required: false, defaultValue: 'dark', validValues: ['light', 'dark', 'auto'] },
        ],
        capabilities: ['text', 'images', 'audio', 'video', 'files', 'markdown', 'html', 'embeds', 'streaming', 'typing-indicator', 'voice'],
    },
    {
        channelId: 'api',
        displayName: 'REST API',
        description: 'OpenAI-compatible REST API',
        requiredFields: [],
        optionalFields: [
            { name: 'port', type: 'number', description: 'API server port', required: false, defaultValue: 8080 },
            { name: 'apiKey', type: 'string', description: 'API authentication key', required: false, sensitive: true },
            { name: 'rateLimitPerMinute', type: 'number', description: 'Rate limit per minute', required: false, defaultValue: 60 },
        ],
        capabilities: ['text', 'images', 'streaming', 'webhooks'],
    },
];

// Initialize built-in schemas
for (const schema of BUILT_IN_SCHEMAS) {
    channelSchemas.set(schema.channelId, schema);
}

// ─── Schema Registry ──────────────────────────────────────────────

/**
 * Register a channel config schema
 */
export function registerChannelSchema(schema: ChannelConfigSchema): void {
    channelSchemas.set(schema.channelId, schema);
}

/**
 * Get schema for a channel
 */
export function getChannelSchema(channelId: string): ChannelConfigSchema | undefined {
    return channelSchemas.get(channelId);
}

/**
 * List all registered channel schemas
 */
export function listChannelSchemas(): ChannelConfigSchema[] {
    return Array.from(channelSchemas.values());
}

/**
 * Get registered channel IDs
 */
export function getRegisteredChannelIds(): string[] {
    return Array.from(channelSchemas.keys());
}

// ─── Validation ───────────────────────────────────────────────────

/**
 * Validate channel configuration against its schema
 */
export function validateChannelConfig(
    channelId: string,
    config: Record<string, unknown>,
): ChannelValidationResult {
    const schema = channelSchemas.get(channelId);
    const errors: ChannelValidationError[] = [];
    const warnings: string[] = [];

    if (!schema) {
        return {
            valid: true, // Unknown channels pass validation (extensibility)
            channelId,
            errors: [],
            warnings: [`No schema registered for channel "${channelId}"`],
        };
    }

    // Check required fields
    for (const field of schema.requiredFields) {
        const value = config[field.name];
        if (value === undefined || value === null || value === '') {
            errors.push({
                field: field.name,
                message: `Required field "${field.name}" is missing: ${field.description}`,
                severity: 'error',
            });
        } else {
            validateFieldType(field, value, errors);
        }
    }

    // Check optional fields for type correctness
    for (const field of schema.optionalFields) {
        const value = config[field.name];
        if (value !== undefined && value !== null) {
            validateFieldType(field, value, errors);
            // Check valid values
            if (field.validValues && !field.validValues.includes(value)) {
                warnings.push(`Field "${field.name}" value "${value}" is not in valid values: ${field.validValues.join(', ')}`);
            }
        }
    }

    // Check for unknown fields
    const knownFields = new Set([
        ...schema.requiredFields.map((f) => f.name),
        ...schema.optionalFields.map((f) => f.name),
    ]);
    for (const key of Object.keys(config)) {
        if (!knownFields.has(key)) {
            warnings.push(`Unknown field "${key}" in ${channelId} config`);
        }
    }

    return {
        valid: errors.filter((e) => e.severity === 'error').length === 0,
        channelId,
        errors,
        warnings,
    };
}

/**
 * Validate all channel configs in a gateway config
 */
export function validateAllChannels(
    channels: Record<string, Record<string, unknown>>,
): ChannelValidationResult[] {
    return Object.entries(channels).map(([channelId, config]) =>
        validateChannelConfig(channelId, config),
    );
}

/**
 * Check if a channel is configured (has minimum required config)
 */
export function isChannelConfigured(
    channelId: string,
    config: Record<string, unknown> | undefined,
): boolean {
    if (!config) return false;
    const schema = channelSchemas.get(channelId);
    if (!schema) return Object.keys(config).length > 0;
    return schema.requiredFields.every((f) => {
        const val = config[f.name];
        return val !== undefined && val !== null && val !== '';
    });
}

/**
 * Get channel capabilities
 */
export function getChannelCapabilities(channelId: string): ChannelCapability[] {
    return channelSchemas.get(channelId)?.capabilities ?? [];
}

/**
 * Check if channel supports a specific capability
 */
export function channelHasCapability(channelId: string, capability: ChannelCapability): boolean {
    return getChannelCapabilities(channelId).includes(capability);
}

// ─── Private Helpers ──────────────────────────────────────────────

function validateFieldType(
    field: ChannelField,
    value: unknown,
    errors: ChannelValidationError[],
): void {
    const expectedType = field.type;
    let actualType: string;

    if (Array.isArray(value)) actualType = 'array';
    else if (value === null) actualType = 'null';
    else actualType = typeof value;

    if (expectedType !== actualType) {
        errors.push({
            field: field.name,
            message: `Field "${field.name}" expected type "${expectedType}" but got "${actualType}"`,
            severity: 'error',
        });
    }
}
