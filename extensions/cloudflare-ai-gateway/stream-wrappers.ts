import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";
import { createSubsystemLogger } from "../../src/logging/subsystem.js";

const log = createSubsystemLogger("cloudflare-ai-gateway-stream");

function shouldPatchAnthropicMessagesPayload(model: ProviderWrapStreamFnContext["model"]): boolean {
  return model?.api === undefined || model.api === "anthropic-messages";
}

function hasThinkingEnabled(payload: Record<string, unknown>): boolean {
  const thinking = payload.thinking;
  return (
    !!thinking &&
    typeof thinking === "object" &&
    !Array.isArray(thinking) &&
    (thinking as { type?: unknown }).type !== "disabled"
  );
}

function isAssistantPrefillMessage(entry: unknown): entry is { role: "assistant"; content: string } {
  return (
    !!entry &&
    typeof entry === "object" &&
    (entry as { role?: unknown }).role === "assistant" &&
    typeof (entry as { content?: unknown }).content === "string"
  );
}

function stripTrailingAssistantPrefill(payload: Record<string, unknown>): number {
  if (!hasThinkingEnabled(payload) || !Array.isArray(payload.messages)) {
    return 0;
  }

  const messages = [...payload.messages];
  let removed = 0;
  while (messages.length > 0 && isAssistantPrefillMessage(messages[messages.length - 1])) {
    messages.pop();
    removed += 1;
  }

  if (removed > 0) {
    payload.messages = messages;
  }
  return removed;
}

export function createCloudflareAiGatewayAnthropicThinkingPrefillWrapper(
  baseStreamFn: StreamFn | undefined,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) =>
    streamWithPayloadPatch(underlying, model, context, options, (payload) => {
      const stripped = stripTrailingAssistantPrefill(payload);
      if (stripped > 0) {
        log.warn(
          `removed ${stripped} trailing assistant prefill message${stripped === 1 ? "" : "s"} because Anthropic extended thinking requires conversations to end with a user turn`,
        );
      }
    });
}

export function wrapCloudflareAiGatewayProviderStream(
  ctx: ProviderWrapStreamFnContext,
): StreamFn | undefined {
  if (!shouldPatchAnthropicMessagesPayload(ctx.model)) {
    return ctx.streamFn;
  }
  return createCloudflareAiGatewayAnthropicThinkingPrefillWrapper(ctx.streamFn);
}

export const testing = { log, shouldPatchAnthropicMessagesPayload };
export { testing as __testing };
