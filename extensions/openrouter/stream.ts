import type { StreamFn } from "@mariozechner/pi-agent-core";
import {
  createOpenRouterSystemCacheWrapper,
  createOpenRouterWrapper,
  isProxyReasoningUnsupported,
} from "coreblow/plugin-sdk/provider-stream";

type OpenRouterStreamWrapContext = {
  streamFn?: StreamFn;
  modelId: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "adaptive";
  extraParams?: Record<string, unknown>;
};

function injectOpenRouterRouting(
  baseStreamFn: StreamFn | undefined,
  providerRouting?: Record<string, unknown>,
): StreamFn | undefined {
  if (!providerRouting) {
    return baseStreamFn;
  }
  return (model, context, options) =>
    (
      baseStreamFn ??
      ((nextModel) => {
        throw new Error(
          `OpenRouter routing wrapper requires an underlying streamFn for ${String(nextModel.id)}.`,
        );
      })
    )(
      {
        ...model,
        compat: { ...model.compat, openRouterRouting: providerRouting },
      } as typeof model,
      context,
      options,
    );
}

export function wrapOpenRouterProviderStream(ctx: OpenRouterStreamWrapContext): StreamFn | undefined {
  let streamFn = ctx.streamFn;
  const providerRouting =
    ctx.extraParams?.provider != null && typeof ctx.extraParams.provider === "object"
      ? (ctx.extraParams.provider as Record<string, unknown>)
      : undefined;
  if (providerRouting) {
    streamFn = injectOpenRouterRouting(streamFn, providerRouting);
  }
  const skipReasoningInjection =
    ctx.modelId === "auto" || isProxyReasoningUnsupported(ctx.modelId);
  const openRouterThinkingLevel = skipReasoningInjection ? undefined : ctx.thinkingLevel;
  streamFn = createOpenRouterWrapper(streamFn, openRouterThinkingLevel);
  return createOpenRouterSystemCacheWrapper(streamFn);
}
