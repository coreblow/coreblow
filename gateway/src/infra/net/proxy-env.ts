/**
 * CoreBlow — Proxy Environment Detection
 *
 * Detects and resolves HTTP/HTTPS proxy configuration from
 * environment variables following undici/curl conventions.
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** All proxy-related environment variable names */
export const PROXY_ENV_KEYS = [
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
] as const;

/** No-proxy list environment variable names */
export const NO_PROXY_KEYS = ['NO_PROXY', 'no_proxy'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProxyConfig {
  /** Resolved proxy URL for the given protocol */
  proxyUrl: string;
  /** Source environment variable name */
  sourceKey: string;
}

// ─── Detection ──────────────────────────────────────────────────────────────

function normalizeValue(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Check if any proxy environment variable is configured.
 */
export function hasProxyEnvConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  for (const key of PROXY_ENV_KEYS) {
    if (normalizeValue(env[key])) return true;
  }
  return false;
}

/**
 * Resolve the proxy URL for a given protocol.
 *
 * Resolution order (matches undici EnvHttpProxyAgent semantics):
 * - Lowercase vars take precedence over uppercase
 * - HTTPS requests prefer https_proxy, then fall back to http_proxy
 * - ALL_PROXY is checked as a final fallback
 * - NO_PROXY bypasses are NOT evaluated here (see isHostExcludedFromProxy)
 */
export function resolveEnvProxyUrl(
  protocol: 'http' | 'https',
  env: NodeJS.ProcessEnv = process.env,
): ProxyConfig | null {
  // Lower-case takes precedence
  const httpProxy = normalizeValue(env.http_proxy) ?? normalizeValue(env.HTTP_PROXY);
  const httpsProxy = normalizeValue(env.https_proxy) ?? normalizeValue(env.HTTPS_PROXY);
  const allProxy = normalizeValue(env.all_proxy) ?? normalizeValue(env.ALL_PROXY);

  if (protocol === 'https') {
    if (httpsProxy) return { proxyUrl: httpsProxy, sourceKey: env.https_proxy ? 'https_proxy' : 'HTTPS_PROXY' };
    if (httpProxy) return { proxyUrl: httpProxy, sourceKey: env.http_proxy ? 'http_proxy' : 'HTTP_PROXY' };
    if (allProxy) return { proxyUrl: allProxy, sourceKey: env.all_proxy ? 'all_proxy' : 'ALL_PROXY' };
    return null;
  }

  if (httpProxy) return { proxyUrl: httpProxy, sourceKey: env.http_proxy ? 'http_proxy' : 'HTTP_PROXY' };
  if (allProxy) return { proxyUrl: allProxy, sourceKey: env.all_proxy ? 'all_proxy' : 'ALL_PROXY' };
  return null;
}

/**
 * Check if proxy is configured for a specific protocol.
 */
export function hasEnvProxyConfigured(
  protocol: 'http' | 'https' = 'https',
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return resolveEnvProxyUrl(protocol, env) !== null;
}

/**
 * Check if a hostname should bypass the proxy based on NO_PROXY.
 *
 * NO_PROXY format: comma-separated list of hostnames/domains.
 * Leading dots match subdomains (e.g., .example.com matches *.example.com).
 * A single `*` bypasses all hosts.
 */
export function isHostExcludedFromProxy(
  hostname: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const noProxy = normalizeValue(env.no_proxy) ?? normalizeValue(env.NO_PROXY);
  if (!noProxy) return false;

  const normalizedHost = hostname.trim().toLowerCase();
  const entries = noProxy.split(',').map((e) => e.trim().toLowerCase());

  for (const entry of entries) {
    if (!entry) continue;
    if (entry === '*') return true;
    if (normalizedHost === entry) return true;
    if (entry.startsWith('.') && normalizedHost.endsWith(entry)) return true;
    if (!entry.startsWith('.') && normalizedHost.endsWith(`.${entry}`)) return true;
  }

  return false;
}
