import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";
import { isOpencodeGoKimiNoReasoningModelId } from "./provider-catalog.js";

function isOpencodeGoDeepSeekV4ModelId(modelId: unknown): boolean {
  return modelId === "deepseek-v4-flash" || modelId === "deepseek-v4-pro";
}

export function createOpencodeGoDeepSeekV4Wrapper(
  baseStreamFn: StreamFn | undefined,
  thinkingLevel: unknown,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    if (model.provider !== "opencode-go" || !isOpencodeGoDeepSeekV4ModelId(model.id)) {
      return underlying(model, context, options);
    }
    return streamWithPayloadPatch(underlying, model, context, options, (payload) => {
      if (thinkingLevel === "off" || thinkingLevel === "none") {
        delete payload.reasoning;
        delete payload.reasoning_effort;
        delete payload.reasoningEffort;
        payload.thinking = { type: "disabled" };
      }
    });
  };
}

export function createOpencodeGoKimiNoReasoningWrapper(baseStreamFn: StreamFn | undefined): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    if (model.provider !== "opencode-go" || !isOpencodeGoKimiNoReasoningModelId(model.id)) {
      return underlying(model, context, options);
    }
    return streamWithPayloadPatch(underlying, model, context, options, (payload) => {
      delete payload.reasoning;
      delete payload.reasoning_effort;
      delete payload.reasoningEffort;
    });
  };
}

export function createOpencodeGoWrapper(
  baseStreamFn: StreamFn | undefined,
  thinkingLevel: unknown,
): StreamFn {
  const kimiWrapped = createOpencodeGoKimiNoReasoningWrapper(baseStreamFn);
  return createOpencodeGoDeepSeekV4Wrapper(kimiWrapped, thinkingLevel);
}
