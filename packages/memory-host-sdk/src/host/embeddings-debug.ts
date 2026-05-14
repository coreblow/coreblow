
import { isTruthyEnvValue } from "./_core-imports.js";
import { createSubsystemLogger } from "./_core-imports.js";
const debugEmbeddings = isTruthyEnvValue(process.env.COREBLOW_DEBUG_MEMORY_EMBEDDINGS);
const log = createSubsystemLogger("memory/embeddings");

export function debugEmbeddingsLog(message: string, meta?: Record<string, unknown>): void {
  if (!debugEmbeddings) {
    return;
  }
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  log.raw(`${message}${suffix}`);
}
