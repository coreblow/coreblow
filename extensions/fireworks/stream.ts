import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { normalizeProviderId } from "coreblow/plugin-sdk/provider-model-shared";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";
import { isFireworksKimiModelId } from "./model-id.js";

function isFireworksProviderId(providerId: string): boolean {
  const normalized = normalizeProviderId(providerId);
  return normalized === "fireworks" || normalized === "fireworks-ai";
}

export function createFireworksKimiThinkingDisabledWrapper(
  baseStreamFn: StreamFn | undefined,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) =>
    streamWithPayloadPatch(underlying, model, context, options, (payloadObj) => {
      payloadObj.thinking = { type: "disabled" };
      delete payloadObj.reasoning;
      delete payloadObj.reasoning_effort;
      delete payloadObj.reasoningEffort;
    });
}

export function wrapFireworksProviderStream(
  ctx: ProviderWrapStreamFnContext,
): StreamFn | undefined {
  if (
    !isFireworksProviderId(ctx.provider) ||
    ctx.model?.api !== "openai-completions" ||
    !isFireworksKimiModelId(ctx.modelId)
  ) {
    return undefined;
  }
  return createFireworksKimiThinkingDisabledWrapper(ctx.streamFn);
}
