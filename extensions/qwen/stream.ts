import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { normalizeProviderId } from "coreblow/plugin-sdk/provider-model-shared";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";

type QwenThinkingLevel = ProviderWrapStreamFnContext["thinkingLevel"];
type QwenThinkingFormat = string | undefined;

function isQwenProviderId(providerId: string): boolean {
  const normalized = normalizeProviderId(providerId);
  return (
    normalized === "qwen" ||
    normalized === "modelstudio" ||
    normalized === "qwencloud" ||
    normalized === "dashscope"
  );
}

function setQwenChatTemplateThinking(payload: Record<string, unknown>, enabled: boolean): void {
  const existing = payload.chat_template_kwargs;
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    const next: Record<string, unknown> = {
      ...(existing as Record<string, unknown>),
      enable_thinking: enabled,
    };
    if (!Object.hasOwn(next, "preserve_thinking")) {
      next.preserve_thinking = true;
    }
    payload.chat_template_kwargs = next;
    return;
  }
  payload.chat_template_kwargs = {
    enable_thinking: enabled,
    preserve_thinking: true,
  };
}

function readQwenThinkingFormatFromModel(model: Parameters<StreamFn>[0]): QwenThinkingFormat {
  if (model.api !== "openai-completions") {
    return undefined;
  }
  const compat =
    model.compat && typeof model.compat === "object"
      ? (model.compat as { thinkingFormat?: unknown })
      : undefined;
  return typeof compat?.thinkingFormat === "string" ? compat.thinkingFormat : undefined;
}

function isThinkingEnabled(params: {
  thinkingLevel: QwenThinkingLevel;
  options?: Parameters<StreamFn>[2];
}): boolean {
  if (params.thinkingLevel === "off") {
    return false;
  }
  const options =
    params.options && typeof params.options === "object" && !Array.isArray(params.options)
      ? (params.options as Record<string, unknown>)
      : undefined;
  if (options?.reasoning === "none") {
    return false;
  }
  return true;
}

function createPayloadPatchStreamWrapper(
  baseStreamFn: StreamFn | undefined,
  patchPayload: (params: {
    payload: Record<string, unknown>;
    model: Parameters<StreamFn>[0];
    options: Parameters<StreamFn>[2];
  }) => void,
  shouldPatch: (params: { model: Parameters<StreamFn>[0] }) => boolean,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return (model, context, options) => {
    if (!shouldPatch({ model })) {
      return underlying(model, context, options);
    }
    return streamWithPayloadPatch(underlying, model, context, options, (payload) => {
      patchPayload({ payload, model, options });
    });
  };
}

export function createQwenThinkingWrapper(
  baseStreamFn: StreamFn | undefined,
  thinkingLevel: QwenThinkingLevel,
  thinkingFormat?: QwenThinkingFormat,
): StreamFn {
  return createPayloadPatchStreamWrapper(
    baseStreamFn,
    ({ payload, model, options }) => {
      const enableThinking = isThinkingEnabled({ thinkingLevel, options });
      const effectiveThinkingFormat = thinkingFormat ?? readQwenThinkingFormatFromModel(model);
      if (effectiveThinkingFormat === "qwen-chat-template") {
        setQwenChatTemplateThinking(payload, enableThinking);
        delete payload.enable_thinking;
      } else {
        payload.enable_thinking = enableThinking;
      }
      delete payload.reasoning_effort;
      delete payload.reasoningEffort;
      delete payload.reasoning;
    },
    ({ model }) => model.api === "openai-completions" && Boolean(model.reasoning),
  );
}

export function wrapQwenProviderStream(ctx: ProviderWrapStreamFnContext): StreamFn | undefined {
  if (!isQwenProviderId(ctx.provider) || (ctx.model && ctx.model.api !== "openai-completions")) {
    return undefined;
  }
  return createQwenThinkingWrapper(
    ctx.streamFn,
    ctx.thinkingLevel,
    ctx.model ? readQwenThinkingFormatFromModel(ctx.model) : undefined,
  );
}
