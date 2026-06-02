import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";

function isVeniceDeepSeekV4ModelId(modelId: unknown): boolean {
  return modelId === "deepseek-v4-flash" || modelId === "deepseek-v4-pro";
}

function ensureVeniceDeepSeekV4Replay(payload: Record<string, unknown>): void {
  delete payload.thinking;
  delete payload.reasoning;
  delete payload.reasoning_effort;

  if (!Array.isArray(payload.messages)) {
    return;
  }
  for (const message of payload.messages) {
    if (!message || typeof message !== "object") {
      continue;
    }
    const record = message as Record<string, unknown>;
    if (record.role === "assistant") {
      record.reasoning_content ??= "";
    }
  }
}

export function createVeniceDeepSeekV4Wrapper(
  baseStreamFn: NonNullable<ProviderWrapStreamFnContext["streamFn"]>,
  thinkingLevel: ProviderWrapStreamFnContext["thinkingLevel"],
): NonNullable<ProviderWrapStreamFnContext["streamFn"]> {
  void thinkingLevel;
  return (model, context, options) =>
    streamWithPayloadPatch(baseStreamFn, model, context, options, (payload) => {
      if (model.provider === "venice" && isVeniceDeepSeekV4ModelId(model.id)) {
        ensureVeniceDeepSeekV4Replay(payload);
      }
    });
}
