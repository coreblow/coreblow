/**
 * Generic JSON POST helper with SSRF policy enforcement.
 *
 * Wraps `withRemoteHttpResponse` to provide a typed JSON POST
 * utility that attaches HTTP status codes to error objects for
 * downstream retry logic.
 */

import type { SsrFPolicy } from "../../../../src/infra/net/ssrf.js";
import { withRemoteHttpResponse } from "./remote-http.js";

/**
 * Sends a JSON POST request and parses the response.
 *
 * @param params.url - Target endpoint
 * @param params.headers - HTTP headers (should include Content-Type)
 * @param params.ssrfPolicy - Optional SSRF policy for hostname validation
 * @param params.body - Request body (will be JSON-serialized)
 * @param params.errorPrefix - Human-readable prefix for error messages
 * @param params.attachStatus - If true, attaches HTTP status code to thrown errors
 * @param params.parse - Custom response parser
 */
export async function postJson<T>(params: {
  url: string;
  headers: Record<string, string>;
  ssrfPolicy?: SsrFPolicy;
  body: unknown;
  errorPrefix: string;
  attachStatus?: boolean;
  parse: (payload: unknown) => T | Promise<T>;
}): Promise<T> {
  return await withRemoteHttpResponse({
    url: params.url,
    ssrfPolicy: params.ssrfPolicy,
    init: {
      method: "POST",
      headers: params.headers,
      body: JSON.stringify(params.body),
    },
    onResponse: async (res) => {
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`${params.errorPrefix}: ${res.status} ${text}`) as Error & {
          status?: number;
        };
        if (params.attachStatus) {
          err.status = res.status;
        }
        throw err;
      }
      return await params.parse(await res.json());
    },
  });
}
