/** Static provider definitions. */
export const STATIC_PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'groq', 'mistral', 'together', 'fireworks'] as const;
export type StaticProvider = typeof STATIC_PROVIDERS[number];
