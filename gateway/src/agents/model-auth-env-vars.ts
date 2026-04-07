/** Model auth environment variable names. */
export const AUTH_ENV_VARS: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_API_KEY', deepseek: 'DEEPSEEK_API_KEY', groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY', together: 'TOGETHER_API_KEY', fireworks: 'FIREWORKS_API_KEY' };
export function getAuthEnvVar(provider: string): string | undefined { return AUTH_ENV_VARS[provider.toLowerCase()]; }
