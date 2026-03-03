/**
 * Shared types and constants used across batch embedding providers.
 */

import type { EmbeddingBatchOutputLine } from "./batch-output.js";

/** Status shape returned by embedding batch APIs (OpenAI-compatible). */
export type EmbeddingBatchStatus = {
  id?: string;
  status?: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
};

/** Alias for provider-specific batch output lines. */
export type ProviderBatchOutputLine = EmbeddingBatchOutputLine;

/** Standard OpenAI-compatible embeddings endpoint path. */
export const EMBEDDING_BATCH_ENDPOINT = "/v1/embeddings";
