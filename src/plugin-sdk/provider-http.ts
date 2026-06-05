// Shared provider-facing HTTP helpers. Keep generic transport utilities here so
// capability SDKs do not depend on each other.

export {
  assertOkOrThrowHttpError,
  fetchWithTimeout,
  fetchWithTimeoutGuarded,
  postJsonRequest,
  postTranscriptionRequest,
  requireTranscriptionText,
} from "../media-understanding/shared.js";
import { normalizeBaseUrl as normalizeSharedBaseUrl } from "../media-understanding/shared.js";
import { ssrfPolicyFromAllowPrivateNetwork } from "./ssrf-policy.js";

export function normalizeBaseUrl(baseUrl: string | undefined, fallback = ""): string {
  return normalizeSharedBaseUrl(baseUrl, fallback);
}

export function resolveProviderHttpRequestConfig(params: {
  baseUrl?: string;
  defaultBaseUrl: string;
  allowPrivateNetwork?: boolean;
  defaultHeaders?: HeadersInit;
  provider?: string;
  capability?: string;
  transport?: string;
}): {
  baseUrl: string;
  allowPrivateNetwork: boolean;
  headers: Headers;
  dispatcherPolicy: undefined;
  ssrfPolicy: ReturnType<typeof ssrfPolicyFromAllowPrivateNetwork>;
} {
  const allowPrivateNetwork = params.allowPrivateNetwork === true;
  return {
    baseUrl: normalizeBaseUrl(params.baseUrl, params.defaultBaseUrl),
    allowPrivateNetwork,
    headers: new Headers(params.defaultHeaders),
    dispatcherPolicy: undefined,
    ssrfPolicy: ssrfPolicyFromAllowPrivateNetwork(allowPrivateNetwork),
  };
}

export type ProviderOperationDeadline = {
  startedAt: number;
  expiresAt: number;
};

export function createProviderOperationDeadline(params: {
  timeoutMs?: number;
  defaultTimeoutMs?: number;
  label?: string;
}): ProviderOperationDeadline {
  const timeoutMs =
    typeof params.timeoutMs === "number" && Number.isFinite(params.timeoutMs) && params.timeoutMs > 0
      ? params.timeoutMs
      : (params.defaultTimeoutMs ?? 120_000);
  const startedAt = Date.now();
  return { startedAt, expiresAt: startedAt + timeoutMs };
}

export function resolveProviderOperationTimeoutMs(params: {
  deadline: ProviderOperationDeadline;
  defaultTimeoutMs: number;
}): number {
  const remaining = params.deadline.expiresAt - Date.now();
  return Math.max(1, Math.min(params.defaultTimeoutMs, remaining));
}

export async function waitProviderOperationPollInterval(params: {
  deadline: ProviderOperationDeadline;
  pollIntervalMs: number;
}): Promise<void> {
  const remaining = params.deadline.expiresAt - Date.now();
  if (remaining <= 0) {
    throw new Error("Provider operation timed out");
  }
  await new Promise((resolve) => setTimeout(resolve, Math.min(params.pollIntervalMs, remaining)));
}
