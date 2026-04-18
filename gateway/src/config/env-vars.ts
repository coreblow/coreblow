/**
 * CoreBlow — Config Environment Variables
 *
 * Maps environment variables to config paths for overriding file-based config.
 * Supports COREBLOW_ prefix convention.
 *
 * @packageDocumentation
 */

/**
 * Environment variable → config path mapping.
 */
export const ENV_MAP: Record<string, string> = {
    // Gateway
    COREBLOW_PORT: 'gateway.port',
    COREBLOW_HOST: 'gateway.host',
    COREBLOW_CORS_ORIGINS: 'gateway.corsOrigins',

    // Provider
    COREBLOW_PROVIDER: 'provider',
    COREBLOW_MODEL: 'model',

    // API Keys
    COREBLOW_OPENAI_API_KEY: 'providers.openai.apiKey',
    COREBLOW_ANTHROPIC_API_KEY: 'providers.anthropic.apiKey',
    COREBLOW_GOOGLE_API_KEY: 'providers.google.apiKey',
    COREBLOW_DEEPSEEK_API_KEY: 'providers.deepseek.apiKey',
    COREBLOW_GROQ_API_KEY: 'providers.groq.apiKey',
    COREBLOW_MISTRAL_API_KEY: 'providers.mistral.apiKey',
    COREBLOW_OPENROUTER_API_KEY: 'providers.openrouter.apiKey',
    COREBLOW_TOGETHER_API_KEY: 'providers.together.apiKey',
    COREBLOW_FIREWORKS_API_KEY: 'providers.fireworks.apiKey',
    COREBLOW_COHERE_API_KEY: 'providers.cohere.apiKey',
    COREBLOW_PERPLEXITY_API_KEY: 'providers.perplexity.apiKey',

    // Agent
    COREBLOW_SYSTEM_PROMPT: 'agent.systemPrompt',
    COREBLOW_MAX_TOKENS: 'agent.maxOutputTokens',
    COREBLOW_TEMPERATURE: 'agent.temperature',
    COREBLOW_CONTEXT_WINDOW: 'agent.maxContextTokens',

    // Logging
    COREBLOW_LOG_LEVEL: 'logging.level',
    COREBLOW_LOG_FORMAT: 'logging.format',
    COREBLOW_LOG_DIR: 'logging.directory',

    // Channels
    DISCORD_BOT_TOKEN: 'channels.discord.token',
    TELEGRAM_BOT_TOKEN: 'channels.telegram.token',
    SLACK_BOT_TOKEN: 'channels.slack.token',
    WHATSAPP_TOKEN: 'channels.whatsapp.token',

    // Security
    COREBLOW_RATE_LIMIT_MAX: 'security.rateLimitMax',
    COREBLOW_MAX_INPUT_LENGTH: 'security.maxInputLength',

    // Ollama
    OLLAMA_BASE_URL: 'providers.ollama.baseUrl',
};

/**
 * Apply environment overrides to a config object.
 * Env vars take precedence over file config.
 */
export function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
    for (const [envKey, configPath] of Object.entries(ENV_MAP)) {
        const envValue = process.env[envKey];
        if (envValue === undefined) continue;

        const parts = configPath.split('.');
        let current = config;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (typeof current[part] !== 'object' || current[part] === null) {
                current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
        }

        const lastPart = parts[parts.length - 1];
        current[lastPart] = coerceValue(envValue, configPath);
    }

    return config;
}

/**
 * Coerce string env values to appropriate types.
 */
function coerceValue(value: string, path: string): unknown {
    // Numeric fields
    if (path.endsWith('.port') || path.endsWith('Tokens') || path.includes('Max') || path.includes('Window') || path.endsWith('.timeout')) {
        const num = parseInt(value, 10);
        return Number.isNaN(num) ? value : num;
    }

    // Float fields
    if (path.endsWith('.temperature') || path.endsWith('.topP')) {
        const num = parseFloat(value);
        return Number.isNaN(num) ? value : num;
    }

    // Boolean fields
    if (path.includes('enable') || path.includes('Enabled') || path.includes('sandboxed') || path.includes('autoEnable')) {
        return value === 'true' || value === '1';
    }

    // Array fields (comma-separated)
    if (path.endsWith('Origins') || path.endsWith('Ips') || path.endsWith('Paths') || path.endsWith('Users')) {
        return value.split(',').map(s => s.trim());
    }

    return value;
}

/**
 * List which env vars are currently set.
 */
export function getActiveEnvOverrides(): Array<{ env: string; path: string; value: string }> {
    const active: Array<{ env: string; path: string; value: string }> = [];
    for (const [envKey, configPath] of Object.entries(ENV_MAP)) {
        const value = process.env[envKey];
        if (value !== undefined) {
            active.push({ env: envKey, path: configPath, value: value.length > 30 ? value.slice(0, 8) + '••••' : value });
        }
    }
    return active;
}
