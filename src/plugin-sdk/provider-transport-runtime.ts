/**
 * Provider transport runtime surface for plugin-sdk parity.
 *
 * CoreBlow handles provider fetch (guardedModelFetch) and OpenAI completions
 * parameter building through per-provider plugin architecture rather than
 * shared transport utilities. The self-contained transport helpers that
 * CoreBlow does share are re-exported here.
 */
export { stripSystemPromptCacheBoundary } from "../agents/system-prompt-cache-boundary.js";
export { transformTransportMessages } from "../agents/transport-message-transform.js";
export {
  coerceTransportToolCallArguments,
  createEmptyTransportUsage,
  createWritableTransportEventStream,
  failTransportStream,
  finalizeTransportStream,
  mergeTransportHeaders,
  sanitizeTransportPayloadText,
  type WritableTransportStream,
} from "../agents/transport-stream-shared.js";
