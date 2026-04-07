/**
 * commands/configure.shared.ts
 * Configuration prompt utilities shared between CLI configure & gateway setup wizard.
 */

/** Standard model provider choices. */
export const MODEL_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
    { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { id: 'google', name: 'Google AI', envVar: 'GOOGLE_API_KEY' },
    { id: 'groq', name: 'Groq', envVar: 'GROQ_API_KEY' },
    { id: 'openrouter', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY' },
] as const;

/** Validate a provider API key format. */
export function validateProviderKey(provider: string, key: string): { valid: boolean; error?: string } {
    if (!key || key.trim().length === 0) return { valid: false, error: 'Key cannot be empty' };
    if (provider === 'openai' && !key.startsWith('sk-')) return { valid: false, error: 'OpenAI keys start with sk-' };
    if (key.length < 10) return { valid: false, error: 'Key too short' };
    return { valid: true };
}

/** Get environment variable name for a provider. */
export function getProviderEnvVar(providerId: string): string | undefined {
    return MODEL_PROVIDERS.find(p => p.id === providerId)?.envVar;
}
