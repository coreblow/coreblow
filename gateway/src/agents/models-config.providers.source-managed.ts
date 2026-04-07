/** Source-managed provider configurations. */
export type ProviderSource = 'env' | 'config' | 'oauth' | 'managed';
export function resolveProviderSource(provider: string): ProviderSource { return process.env[`${provider.toUpperCase()}_API_KEY`] ? 'env' : 'config'; }
