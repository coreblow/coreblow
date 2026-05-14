/**
 * Retrying JSON POST for batch embedding API calls.
 *
 * Wraps `postJson` with exponential backoff retry logic.
 * Retries automatically on:
 * - HTTP 429 (rate limit)
 * - HTTP 5xx (server errors)
 */

import type { SsrFPolicy } from "./_core-imports.js";
import { retryAsync } from "./_core-imports.js";
import { postJson } from "./post-json.js";

/**
 * Posts JSON to the given URL with automatic retry on transient failures.
 *
 * Retry config: up to 3 attempts, 300ms–2000ms delay with 20% jitter.
 * Only retries on HTTP 429 (rate limit) or 5xx (server error).
 */
export async function postJsonWithRetry<T>(params: {
  url: string;
  headers: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  body: unknown;
  errorPrefix: string;
}): Promise<T> {
  return await retryAsync(
    async () => {
      return await postJson<T>({
        url: params.url,
        headers: params.headers,
        ssrfPolicy: params.ssrfPolicy,
        body: params.body,
        errorPrefix: params.errorPrefix,
        attachStatus: true,
        parse: async (payload) => payload as T,
      });
    },
    {
      attempts: 3,
      minDelayMs: 300,
      maxDelayMs: 2000,
      jitter: 0.2,
      shouldRetry: (err) => {
        const status = (err as { status?: number }).status;
        return status === 429 || (typeof status === "number" && status >= 500);
      },
    },
  );
}
