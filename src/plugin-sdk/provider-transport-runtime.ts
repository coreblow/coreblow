/**
 * Provider transport runtime surface for plugin-sdk parity.
 *
 * CoreBlow delegates provider transport execution to its native OOP
 * agent engine and standard \`pi-ai\` integration.
 * This surface adapts legacy transport structures to CoreBlow's equivalents.
 */

import { fetchWithSsrFGuard } from "../infra/net/fetch-guard.js";

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
 * CoreBlow providers generally execute using the platform's \`fetchWithSsrFGuard\`
 * rather than a shared generic builder. This adapter maps the legacy shape
 * to the actual hardened fetch execution pathway used by CoreBlow.
 */
export function buildGuardedModelFetch(
  _model: unknown, // Model<Api>
  _timeoutMs?: number,
  options?: { sanitizeSse?: boolean },
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const result = await fetchWithSsrFGuard({
      url: typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
      init,
      mode: "strict",
    });
    return result.response;
  };
}

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
