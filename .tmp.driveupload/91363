/** Self-hosted provider defaults (Ollama, LM Studio, etc). */
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const LMSTUDIO_DEFAULT_URL = 'http://localhost:1234/v1';
export function resolveSelfHostedUrl(provider: string): string | undefined { if (provider === 'ollama') return process.env.OLLAMA_HOST ?? OLLAMA_DEFAULT_URL; if (provider === 'lmstudio') return LMSTUDIO_DEFAULT_URL; return undefined; }
