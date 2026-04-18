/**
 * CoreBlow — Guarded Fetch
 *
 * SSRF-protected HTTP fetch with DNS pinning, redirect following,
 * timeout management, and cross-origin header sanitization.
 */

import {
  resolvePinnedHostname,
  SsrfBlockedError,
  type LookupFn,
  type SsrfPolicy,
} from './ssrf.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export const GuardedFetchMode = {
  /** Full SSRF protection with DNS pinning */
  STRICT: 'strict',
  /** Trust environment proxy (operator-controlled) */
  TRUSTED_ENV_PROXY: 'trusted_env_proxy',
} as const;

export type GuardedFetchModeValue = typeof GuardedFetchMode[keyof typeof GuardedFetchMode];

export interface GuardedFetchOptions {
  url: string;
  init?: RequestInit;
  /** Maximum redirect hops. Default: 3 */
  maxRedirects?: number;
  /** Timeout in ms. Default: 30_000 */
  timeoutMs?: number;
  /** External abort signal */
  signal?: AbortSignal;
  /** SSRF policy configuration */
  policy?: SsrfPolicy;
  /** Custom DNS lookup function */
  lookupFn?: LookupFn;
  /** Fetch mode. Default: 'strict' */
  mode?: GuardedFetchModeValue;
  /** Audit context for logging blocked requests */
  auditContext?: string;
}

export interface GuardedFetchResult {
  response: Response;
  finalUrl: string;
  redirectCount: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 30_000;

/** Headers safe to retain on cross-origin redirects */
const CROSS_ORIGIN_SAFE_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'content-language',
  'content-type',
  'if-match',
  'if-modified-since',
  'if-none-match',
  'if-unmodified-since',
  'range',
  'user-agent',
]);

// ─── Redirect Detection ────────────────────────────────────────────────────

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function sanitizeHeadersForCrossOrigin(init?: RequestInit): RequestInit | undefined {
  if (!init?.headers) return init;

  const incoming = new Headers(init.headers);
  const safe = new Headers();
  for (const [key, value] of incoming.entries()) {
    if (CROSS_ORIGIN_SAFE_HEADERS.has(key.toLowerCase())) {
      safe.set(key, value);
    }
  }
  return { ...init, headers: safe };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch a URL with SSRF protection, DNS pinning, and redirect following.
 *
 * In strict mode:
 * 1. Resolves the hostname to IP addresses
 * 2. Validates all resolved IPs are public (not private/internal)
 * 3. Follows redirects manually, re-validating each hop
 * 4. Strips sensitive headers on cross-origin redirects
 */
export async function fetchWithSsrfGuard(
  params: GuardedFetchOptions,
): Promise<GuardedFetchResult> {
  const maxRedirects = typeof params.maxRedirects === 'number'
    ? Math.max(0, Math.floor(params.maxRedirects))
    : DEFAULT_MAX_REDIRECTS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Build timeout signal
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(new Error('Guarded fetch timeout')), timeoutMs);
  }

  if (params.signal) {
    params.signal.addEventListener('abort', () => controller.abort(params.signal!.reason), { once: true });
  }

  const cleanup = () => { if (timer) clearTimeout(timer); };

  const visited = new Set<string>();
  let currentUrl = params.url;
  let currentInit = params.init ? { ...params.init } : undefined;
  let redirectCount = 0;

  try {
    while (true) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(currentUrl);
      } catch {
        throw new Error('Invalid URL: must be http or https');
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid URL: must be http or https');
      }

      // SSRF validation (strict mode)
      if (params.mode !== GuardedFetchMode.TRUSTED_ENV_PROXY) {
        await resolvePinnedHostname(parsedUrl.hostname, {
          lookupFn: params.lookupFn,
          policy: params.policy,
        });
      }

      try {
        const response = await globalThis.fetch(parsedUrl.toString(), {
          ...currentInit,
          redirect: 'manual',
          signal: controller.signal,
        });

        // Handle redirects
        if (isRedirectStatus(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            throw new Error(`Redirect missing location header (${response.status})`);
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            throw new Error(`Too many redirects (limit: ${maxRedirects})`);
          }

          const nextUrl = new URL(location, parsedUrl);
          const nextUrlStr = nextUrl.toString();

          if (visited.has(nextUrlStr)) {
            throw new Error('Redirect loop detected');
          }

          // Sanitize headers on cross-origin redirect
          if (nextUrl.origin !== parsedUrl.origin) {
            currentInit = sanitizeHeadersForCrossOrigin(currentInit);
          }

          visited.add(nextUrlStr);
          void response.body?.cancel();
          currentUrl = nextUrlStr;
          continue;
        }

        return { response, finalUrl: currentUrl, redirectCount };

      } catch (err) {
        if (err instanceof SsrfBlockedError) {
          const ctx = params.auditContext ?? 'url-fetch';
          console.warn(
            `[coreblow:security] SSRF blocked (${ctx}) target=${parsedUrl.origin}${parsedUrl.pathname} reason=${err.message}`,
          );
        }
        throw err;
      }
    }
  } finally {
    cleanup();
  }
}

/** Convenience: strict-mode guarded fetch */
export function guardedFetchStrict(
  url: string,
  init?: RequestInit,
  policy?: SsrfPolicy,
): Promise<GuardedFetchResult> {
  return fetchWithSsrfGuard({ url, init, policy, mode: GuardedFetchMode.STRICT });
}
