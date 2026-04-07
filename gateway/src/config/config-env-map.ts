/**
 * config/config-env-map.ts
 * Environment variable → config path mapping.
 * Ported from OpenClaw src/config/config-env-vars.ts.
 */

export interface EnvConfigMapping {
    envVar: string;
    configPath: string;
    description: string;
    sensitive: boolean;
}

const ENV_CONFIG_MAP: EnvConfigMapping[] = [
    // Gateway
    { envVar: 'COREBLOW_TOKEN', configPath: 'gateway.auth.token', description: 'Gateway authentication token', sensitive: true },
    { envVar: 'COREBLOW_PORT', configPath: 'gateway.port', description: 'Gateway server port', sensitive: false },
    { envVar: 'COREBLOW_HOST', configPath: 'gateway.host', description: 'Gateway bind host', sensitive: false },
    { envVar: 'COREBLOW_ENCRYPTION_KEY', configPath: 'secrets.encryption.key', description: 'Encryption key for stored secrets', sensitive: true },
    { envVar: 'COREBLOW_INSTANCE_ID', configPath: 'gateway.instanceId', description: 'Gateway instance identifier', sensitive: false },

    // LLM Providers
    { envVar: 'OPENAI_API_KEY', configPath: 'models.openai.apiKey', description: 'OpenAI API key', sensitive: true },
    { envVar: 'ANTHROPIC_API_KEY', configPath: 'models.anthropic.apiKey', description: 'Anthropic API key', sensitive: true },
    { envVar: 'GOOGLE_AI_KEY', configPath: 'models.google.apiKey', description: 'Google AI API key', sensitive: true },
    { envVar: 'GOOGLE_AI_STUDIO_KEY', configPath: 'models.google.aiStudioKey', description: 'Google AI Studio key', sensitive: true },
    { envVar: 'AZURE_OPENAI_API_KEY', configPath: 'models.azure.apiKey', description: 'Azure OpenAI API key', sensitive: true },
    { envVar: 'AZURE_OPENAI_ENDPOINT', configPath: 'models.azure.endpoint', description: 'Azure OpenAI endpoint', sensitive: false },
    { envVar: 'AWS_ACCESS_KEY_ID', configPath: 'models.bedrock.accessKeyId', description: 'AWS access key for Bedrock', sensitive: true },
    { envVar: 'AWS_SECRET_ACCESS_KEY', configPath: 'models.bedrock.secretAccessKey', description: 'AWS secret key for Bedrock', sensitive: true },

    // Channels
    { envVar: 'DISCORD_TOKEN', configPath: 'channels.discord.token', description: 'Discord bot token', sensitive: true },
    { envVar: 'TELEGRAM_BOT_TOKEN', configPath: 'channels.telegram.token', description: 'Telegram bot token', sensitive: true },
    { envVar: 'SLACK_BOT_TOKEN', configPath: 'channels.slack.token', description: 'Slack bot token', sensitive: true },
    { envVar: 'SLACK_SIGNING_SECRET', configPath: 'channels.slack.signingSecret', description: 'Slack signing secret', sensitive: true },
    { envVar: 'SIGNAL_PHONE_NUMBER', configPath: 'channels.signal.phoneNumber', description: 'Signal phone number', sensitive: false },
    { envVar: 'SIGNAL_PASSWORD', configPath: 'channels.signal.password', description: 'Signal REST API password', sensitive: true },
    { envVar: 'GMAIL_ADDRESS', configPath: 'channels.gmail.address', description: 'Gmail address', sensitive: false },
    { envVar: 'GMAIL_APP_PASSWORD', configPath: 'channels.gmail.appPassword', description: 'Gmail app password', sensitive: true },
    { envVar: 'WHATSAPP_TOKEN', configPath: 'channels.whatsapp.token', description: 'WhatsApp API token', sensitive: true },

    // Logging
    { envVar: 'LOG_LEVEL', configPath: 'logging.level', description: 'Log level', sensitive: false },
    { envVar: 'LOG_FILE', configPath: 'logging.file', description: 'Log file path', sensitive: false },
    { envVar: 'LOG_FORMAT', configPath: 'logging.format', description: 'Log format (json|pretty)', sensitive: false },

    // Database
    { envVar: 'DATABASE_URL', configPath: 'database.url', description: 'Database connection URL', sensitive: true },
    { envVar: 'REDIS_URL', configPath: 'cache.redis.url', description: 'Redis connection URL', sensitive: true },
];

/**
 * Get all env→config mappings.
 */
export function getEnvConfigMap(): ReadonlyArray<EnvConfigMapping> {
    return ENV_CONFIG_MAP;
}

/**
 * Find config path for an environment variable.
 */
export function resolveConfigPathForEnv(envVar: string): string | undefined {
    return ENV_CONFIG_MAP.find((m) => m.envVar === envVar)?.configPath;
}

/**
 * Find environment variable for a config path.
 */
export function resolveEnvForConfigPath(configPath: string): string | undefined {
    return ENV_CONFIG_MAP.find((m) => m.configPath === configPath)?.envVar;
}

/**
 * Get all sensitive env var names.
 */
export function listSensitiveEnvVars(): string[] {
    return ENV_CONFIG_MAP.filter((m) => m.sensitive).map((m) => m.envVar);
}

/**
 * Discover which mapped env vars are currently set.
 */
export function discoverSetEnvVars(env: NodeJS.ProcessEnv = process.env): EnvConfigMapping[] {
    return ENV_CONFIG_MAP.filter((m) => env[m.envVar] !== undefined);
}
