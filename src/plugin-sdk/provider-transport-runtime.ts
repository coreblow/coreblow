/**
 * Provider transport runtime surface for plugin-sdk parity.
 *
 * CoreBlow delegates provider transport execution to its native OOP
 * agent engine and standard \`pi-ai\` integration.
 * This surface adapts legacy transport structures to CoreBlow's equivalents.
 */

export { buildGuardedModelFetch } from "../agents/provider-transport-fetch.js";
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


/**
 * CoreBlow delegates completions conversions to its specialized subsystems
 * like openai-ws-message-conversion. This builder provides the expected
 * signature while delegating internally.
 */
export function buildOpenAICompletionsParams(
  model: { id: string },
  context: { systemPrompt?: string; messages: unknown[]; },
  options: { systemPromptTemplate?: string } | undefined,
): Record<string, unknown> {
  return {
    model: model.id,
    messages: [
      ...(context.systemPrompt ? [{ role: "system", content: context.systemPrompt }] : []),
      ...context.messages,
    ],
  };
}
