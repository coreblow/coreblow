/**
 * Utilities for extracting human-readable error messages from
 * embedding batch API responses.
 *
 * Batch responses can nest errors at multiple levels (top-level error,
 * response body string, response body object with error.message).
 * These helpers normalize all variants into a single string.
 */

/** Shape of a batch output line that may contain error information. */
type BatchOutputErrorLike = {
  error?: { message?: string };
  response?: {
    body?:
      | string
      | {
          error?: { message?: string };
        };
  };
};

/**
 * Attempts to extract an error message from a response body.
 * Handles both string bodies and structured `{ error: { message } }` objects.
 */
function getResponseErrorMessage(line: BatchOutputErrorLike | undefined): string | undefined {
  const body = line?.response?.body;
  if (typeof body === "string") {
    return body || undefined;
  }
  if (!body || typeof body !== "object") {
    return undefined;
  }
  return typeof body.error?.message === "string" ? body.error.message : undefined;
}

/**
 * Scans an array of batch output lines and returns the first
 * error message found, checking both top-level errors and
 * nested response body errors.
 */
export function extractBatchErrorMessage(lines: BatchOutputErrorLike[]): string | undefined {
  const first = lines.find((line) => line.error?.message || getResponseErrorMessage(line));
  return first?.error?.message ?? getResponseErrorMessage(first);
}

/**
 * Wraps an unknown error into a standardized "file unavailable" message.
 * Used when the batch error/output file cannot be retrieved.
 */
export function formatUnavailableBatchError(err: unknown): string | undefined {
  const message = err instanceof Error ? err.message : String(err);
  return message ? `error file unavailable: ${message}` : undefined;
}
