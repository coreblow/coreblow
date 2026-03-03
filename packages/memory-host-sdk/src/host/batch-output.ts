/**
 * Parsing and application of embedding batch output lines.
 *
 * Embedding providers return results in JSON-L format where each
 * line corresponds to a request identified by `custom_id`.
 * This module processes individual lines, extracting embeddings
 * into a lookup map and tracking errors and remaining IDs.
 */

/** Shape of a single line in a batch embedding output file. */
export type EmbeddingBatchOutputLine = {
  custom_id?: string;
  error?: { message?: string };
  response?: {
    status_code?: number;
    body?:
      | {
          data?: Array<{
            embedding?: number[];
          }>;
          error?: { message?: string };
        }
      | string;
  };
};

/**
 * Processes a single batch output line:
 * - Removes `custom_id` from the `remaining` set
 * - On error (top-level or HTTP 4xx/5xx), appends to `errors`
 * - On success, extracts the first embedding vector into `byCustomId`
 * - Silently skips lines without a `custom_id`
 */
export function applyEmbeddingBatchOutputLine(params: {
  line: EmbeddingBatchOutputLine;
  remaining: Set<string>;
  errors: string[];
  byCustomId: Map<string, number[]>;
}): void {
  const customId = params.line.custom_id;
  if (!customId) {
    return;
  }
  params.remaining.delete(customId);

  // Check for top-level error
  const errorMessage = params.line.error?.message;
  if (errorMessage) {
    params.errors.push(`${customId}: ${errorMessage}`);
    return;
  }

  // Check for HTTP-level error
  const response = params.line.response;
  const statusCode = response?.status_code ?? 0;
  if (statusCode >= 400) {
    const bodyErrorMsg =
      response?.body && typeof response.body === "object"
        ? (response.body as { error?: { message?: string } }).error?.message
        : undefined;
    const bodyStringMsg = typeof response?.body === "string" ? response.body : undefined;
    params.errors.push(`${customId}: ${bodyErrorMsg ?? bodyStringMsg ?? "unknown error"}`);
    return;
  }

  // Extract embedding vector
  const data =
    response?.body && typeof response.body === "object" ? (response.body.data ?? []) : [];
  const embedding = data[0]?.embedding ?? [];
  if (embedding.length === 0) {
    params.errors.push(`${customId}: empty embedding`);
    return;
  }
  params.byCustomId.set(customId, embedding);
}
