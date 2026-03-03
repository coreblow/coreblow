/**
 * Uploads a JSONL batch file to an embedding API provider.
 *
 * Serializes an array of embedding requests into JSON-L format,
 * wraps them in a FormData upload, and sends to the provider's
 * /files endpoint. Returns the file ID for subsequent batch
 * job creation.
 */

import {
  buildBatchHeaders,
  normalizeBatchBaseUrl,
  type BatchHttpClientConfig,
} from "./batch-utils.js";
import { hashText } from "./internal.js";
import { withRemoteHttpResponse } from "./remote-http.js";

/**
 * Uploads embedding requests as a JSONL file for batch processing.
 *
 * @param params.client - HTTP client configuration (base URL, auth, SSRF policy)
 * @param params.requests - Array of embedding request objects to serialize
 * @param params.errorPrefix - Human-readable prefix for error messages
 * @returns The uploaded file ID from the provider
 * @throws If the upload fails or the response lacks a file ID
 */
export async function uploadBatchJsonlFile(params: {
  client: BatchHttpClientConfig;
  requests: unknown[];
  errorPrefix: string;
}): Promise<string> {
  const baseUrl = normalizeBatchBaseUrl(params.client);
  const jsonl = params.requests.map((request) => JSON.stringify(request)).join("\n");
  const form = new FormData();
  form.append("purpose", "batch");
  form.append(
    "file",
    new Blob([jsonl], { type: "application/jsonl" }),
    `memory-embeddings.${hashText(String(Date.now()))}.jsonl`,
  );

  const filePayload = await withRemoteHttpResponse({
    url: `${baseUrl}/files`,
    ssrfPolicy: params.client.ssrfPolicy,
    init: {
      method: "POST",
      headers: buildBatchHeaders(params.client, { json: false }),
      body: form,
    },
    onResponse: async (fileRes) => {
      if (!fileRes.ok) {
        const text = await fileRes.text();
        throw new Error(`${params.errorPrefix}: ${fileRes.status} ${text}`);
      }
      return (await fileRes.json()) as { id?: string };
    },
  });
  if (!filePayload.id) {
    throw new Error(`${params.errorPrefix}: missing file id`);
  }
  return filePayload.id;
}
