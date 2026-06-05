
import { fetchWithSsrFGuard, hasEnvHttpProxyConfigured } from "./_core-imports.js";
import type { SsrFPolicy } from "./_core-imports.js";

export const MEMORY_REMOTE_TRUSTED_ENV_PROXY_MODE = "trusted_env_proxy";

export function ssrfPolicyFromHttpBaseUrlAllowedHostname(
  baseUrl: string,
): SsrFPolicy | undefined {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    // Keep policy tied to the configured host so private operator endpoints
    // continue to work, while cross-host redirects stay blocked.
    return { allowedHostnames: [parsed.hostname] };
  } catch {
    return undefined;
  }
}

export const buildRemoteBaseUrlPolicy: (baseUrl: string) => SsrFPolicy | undefined =
  ssrfPolicyFromHttpBaseUrlAllowedHostname;

export function shouldUseEnvHttpProxyForUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return hasEnvHttpProxyConfigured(parsed.protocol === "https:" ? "https" : "http");
  } catch {
    return false;
  }
}

export async function withRemoteHttpResponse<T>(params: {
  url: string;
  init?: RequestInit;
  signal?: AbortSignal;
  ssrfPolicy?: SsrFPolicy;
  fetchImpl?: typeof fetch;
  fetchWithSsrFGuardImpl?: typeof fetchWithSsrFGuard;
  shouldUseEnvHttpProxyForUrlImpl?: typeof shouldUseEnvHttpProxyForUrl;
  auditContext?: string;
  onResponse: (response: Response) => Promise<T>;
}): Promise<T> {
  const guardedFetch = params.fetchWithSsrFGuardImpl ?? fetchWithSsrFGuard;
  const shouldUseEnvProxy = params.shouldUseEnvHttpProxyForUrlImpl ?? shouldUseEnvHttpProxyForUrl;
  const { response, release } = await guardedFetch({
    url: params.url,
    fetchImpl: params.fetchImpl,
    init: params.init,
    signal: params.signal,
    policy: params.ssrfPolicy,
    auditContext: params.auditContext ?? "memory-remote",
    ...(shouldUseEnvProxy(params.url) ? { mode: MEMORY_REMOTE_TRUSTED_ENV_PROXY_MODE } : {}),
  });
  try {
    return await params.onResponse(response);
  } finally {
    await release();
  }
}
