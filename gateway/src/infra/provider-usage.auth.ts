/** CoreBlow — Provider Usage Auth */
export interface ProviderAuthConfig { provider: string; apiKey?: string; baseUrl?: string; orgId?: string; }
export function resolveProviderAuth(provider: string, env: NodeJS.ProcessEnv = process.env): ProviderAuthConfig {
  const upper = provider.toUpperCase().replace(/-/g, "_");
  return { provider, apiKey: env[upper + "_API_KEY"]?.trim(), baseUrl: env[upper + "_BASE_URL"]?.trim(), orgId: env[upper + "_ORG_ID"]?.trim() };
}
