/**
 * CoreBlow — Config Defaults
 *
 * Central defaults for all configuration sections.
 * Provides sensible defaults for gateway, agent, channels, and providers.
 *
 * @packageDocumentation
 */

export const CONFIG_DEFAULTS = {
    /** Gateway server defaults */
    gateway: {
        port: 3000,
        host: '0.0.0.0',
        corsOrigins: ['http://localhost:*', 'http://127.0.0.1:*'],
        maxRequestBodySize: '1mb',
        shutdownGracePeriod: 5000,
        healthCheckInterval: 30_000,
        sessionTTL: 30 * 60 * 1000,
        maxSessionsPerUser: 5,
    },

    /** Agent runtime defaults */
    agent: {
        systemPrompt: 'You are CoreBlow, a helpful AI assistant.',
        maxContextTokens: 128_000,
        maxOutputTokens: 4_096,
        temperature: 0.7,
        topP: 1,
        presencePenalty: 0,
        frequencyPenalty: 0,
        maxTurnsPerSession: 50,
        streamByDefault: true,
        thinkingEnabled: false,
    },

    /** Provider defaults */
    providers: {
        timeout: 60_000,
        maxRetries: 3,
        retryDelay: 1000,
        rateLimitRpm: 60,
        rateLimitTpm: 100_000,
    },

    /** Channel defaults */
    channels: {
        reconnectDelay: 3000,
        maxReconnectDelay: 60_000,
        backoffMultiplier: 2,
        heartbeatInterval: 30_000,
        messageQueueSize: 100,
    },

    /** Logging defaults */
    logging: {
        level: 'info' as const,
        format: 'json' as const,
        maxFileSize: '10mb',
        maxFiles: 5,
        directory: 'logs',
    },

    /** Security defaults */
    security: {
        maxInputLength: 32_000,
        rateLimitWindow: 60_000,
        rateLimitMax: 30,
        enablePiiScanning: false,
        enableGuardrails: true,
    },

    /** Cron defaults */
    cron: {
        enabled: false,
        timezone: 'UTC',
        maxConcurrentJobs: 5,
    },

    /** Plugin defaults */
    plugins: {
        autoEnable: true,
        sandboxed: true,
        maxPlugins: 50,
    },
} as const;

export type ConfigDefaults = typeof CONFIG_DEFAULTS;

/**
 * Deep merge with defaults — fills in missing keys from defaults.
 */
export function applyDefaults<T extends Record<string, unknown>>(
    userConfig: Partial<T>,
    defaults: T,
): T {
    const result = { ...defaults } as Record<string, unknown>;
    for (const [key, value] of Object.entries(userConfig)) {
        if (value !== undefined && value !== null) {
            if (typeof value === 'object' && !Array.isArray(value) && typeof result[key] === 'object' && !Array.isArray(result[key])) {
                result[key] = applyDefaults(value as Record<string, unknown>, result[key] as Record<string, unknown>);
            } else {
                result[key] = value;
            }
        }
    }
    return result as T;
}
