/**
 * Batch job lifecycle management for embedding operations.
 *
 * Tracks batch job states, detects terminal failures,
 * and orchestrates completion resolution with optional
 * polling/wait behavior.
 */

/** Terminal failure states that indicate a batch job cannot recover. */
const TERMINAL_FAILURE_STATES = new Set(["failed", "expired", "cancelled", "canceled"]);

/** Minimal shape for batch status objects from any provider. */
type BatchStatusLike = {
  id?: string;
  status?: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
};

/** Result of a successfully completed batch job. */
export type BatchCompletionResult = {
  outputFileId: string;
  errorFileId?: string;
};

/**
 * Extracts the output file ID from a completed batch status.
 * Throws if the batch completed without producing an output file.
 */
export function resolveBatchCompletionFromStatus(params: {
  provider: string;
  batchId: string;
  status: BatchStatusLike;
}): BatchCompletionResult {
  if (!params.status.output_file_id) {
    throw new Error(`${params.provider} batch ${params.batchId} completed without output file`);
  }
  return {
    outputFileId: params.status.output_file_id,
    errorFileId: params.status.error_file_id ?? undefined,
  };
}

/**
 * Checks whether a batch is in a terminal failure state and throws
 * a descriptive error if so. Optionally reads the error file for
 * additional detail.
 */
export async function throwIfBatchTerminalFailure(params: {
  provider: string;
  status: BatchStatusLike;
  readError: (errorFileId: string) => Promise<string | undefined>;
}): Promise<void> {
  const state = params.status.status ?? "unknown";
  if (!TERMINAL_FAILURE_STATES.has(state)) {
    return;
  }
  const detail = params.status.error_file_id
    ? await params.readError(params.status.error_file_id)
    : undefined;
  const suffix = detail ? `: ${detail}` : "";
  throw new Error(`${params.provider} batch ${params.status.id ?? "<unknown>"} ${state}${suffix}`);
}

/**
 * Resolves a completed batch result — either immediately if the
 * batch is already complete, or by waiting via the provided callback.
 * Throws if waiting is disabled and the batch is not yet complete.
 */
export async function resolveCompletedBatchResult(params: {
  provider: string;
  status: BatchStatusLike;
  wait: boolean;
  waitForBatch: () => Promise<BatchCompletionResult>;
}): Promise<BatchCompletionResult> {
  const batchId = params.status.id ?? "<unknown>";
  if (!params.wait && params.status.status !== "completed") {
    throw new Error(
      `${params.provider} batch ${batchId} submitted; enable remote.batch.wait to await completion`,
    );
  }
  const completed =
    params.status.status === "completed"
      ? resolveBatchCompletionFromStatus({
          provider: params.provider,
          batchId,
          status: params.status,
        })
      : await params.waitForBatch();
  if (!completed.outputFileId) {
    throw new Error(`${params.provider} batch ${batchId} completed without output file`);
  }
  return completed;
}
