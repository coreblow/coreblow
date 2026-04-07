/** Model auth from environment variables. */
export function resolveApiKeyFromEnv(provider: string): string | undefined {
    const envMap: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_API_KEY', deepseek: 'DEEPSEEK_API_KEY', groq: 'GROQ_API_KEY', mistral: 'MISTRAL_API_KEY' };
    const envVar = envMap[provider.toLowerCase()];
    return envVar ? process.env[envVar] : undefined;
}
