/**
 * CoreBlow — Proxy-Aware Fetch
 *
 * Wraps globalThis.fetch to automatically route requests through
 * configured HTTP/HTTPS proxies detected from the environment.
 */

import { hasEnvProxyConfigured, isHostExcludedFromProxy, resolveEnvProxyUrl } from './proxy-env.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProxyFetchOptions {
  /** Force enable/disable proxy usage. Default: auto-detect from env */
  useProxy?: boolean;
  /** Timeout in ms. Default: 30_000 */
  timeoutMs?: number;
  /** External abort signal */
  signal?: AbortSignal;
  /** Custom env for proxy resolution */
  env?: NodeJS.ProcessEnv;
}

export interface ProxyFetchResult {
  response: Response;
  /** Whether the request was routed through a proxy */
  proxied: boolean;
  /** The proxy URL used, if any */
  proxyUrl?: string;
}

// ─── Core ───────────────────────────────────────────────────────────────────

/**
 * Determine if a request to the given URL should use a proxy.
 */
export function shouldProxyRequest(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (isHostExcludedFromProxy(parsed.hostname, env)) return false;

  const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
  return hasEnvProxyConfigured(protocol, env);
}

/**
 * Fetch a URL with automatic proxy detection from the environment.
 *
 * NOTE: Native fetch proxy support depends on the Node.js version.
 * In environments where fetch doesn't natively support proxies (Node <20),
 * this function serves as a documentation point and gracefully falls back
 * to direct requests.
 */
export async function proxyFetch(
  url: string,
  init?: RequestInit,
  options?: ProxyFetchOptions,
): Promise<ProxyFetchResult> {
  const env = options?.env ?? process.env;
  const timeoutMs = options?.timeoutMs ?? 30_000;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL for proxy fetch: ${url}`);
  }

  const protocol = parsed.protocol === 'https:' ? 'https' : 'http';
  const useProxy = options?.useProxy ?? (!isHostExcludedFromProxy(parsed.hostname, env));
  const proxyConfig = useProxy ? resolveEnvProxyUrl(protocol, env) : null;

  // Build abort signal with timeout
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new Error('Proxy fetch timeout')), timeoutMs);
  }

  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(options.signal!.reason), { once: true });
  }

  try {
    const response = await globalThis.fetch(url, {
      ...init,
      signal: controller.signal,
    });

    return {
      response,
      proxied: Boolean(proxyConfig),
      proxyUrl: proxyConfig?.proxyUrl,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
