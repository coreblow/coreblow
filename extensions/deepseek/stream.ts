import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";
import { isDeepSeekV4ModelRef } from "./models.js";

function ensureDeepSeekV4ReplayPayload(payload: Record<string, unknown>): void {
  if (payload.thinking && typeof payload.thinking === "object") {
    const thinking = payload.thinking as Record<string, unknown>;
    if (thinking.type === "disabled") {
      delete payload.reasoning;
      delete payload.reasoning_effort;
      delete payload.reasoningEffort;
      return;
    }
  }

  delete payload.thinking;
  delete payload.reasoning;
  delete payload.reasoning_effort;
  delete payload.reasoningEffort;

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

export function createDeepSeekV4ThinkingWrapper(
  baseStreamFn: NonNullable<ProviderWrapStreamFnContext["streamFn"]>,
  thinkingLevel: ProviderWrapStreamFnContext["thinkingLevel"],
): NonNullable<ProviderWrapStreamFnContext["streamFn"]> {
  const disableThinking = thinkingLevel === "off";
  return (model, context, options) =>
    streamWithPayloadPatch(baseStreamFn, model, context, options, (payload) => {
      if (!isDeepSeekV4ModelRef(model)) {
        return;
      }
      if (disableThinking) {
        payload.thinking = { type: "disabled" };
      }
      ensureDeepSeekV4ReplayPayload(payload);
      if (disableThinking) {
        payload.thinking = { type: "disabled" };
      }
    });
}
