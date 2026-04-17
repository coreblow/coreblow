/** CLI backend selection. */
export type CliBackend = 'anthropic' | 'openai' | 'google' | 'ollama' | 'custom';
export function resolveCliBackend(provider?: string): CliBackend { return (provider as CliBackend) ?? 'anthropic'; }
export function getCliBackendLabel(backend: CliBackend): string { const labels: Record<string, string> = { anthropic: 'Anthropic Claude', openai: 'OpenAI', google: 'Google Gemini', ollama: 'Ollama', custom: 'Custom' }; return labels[backend] ?? backend; }
