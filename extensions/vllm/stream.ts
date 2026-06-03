import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ProviderWrapStreamFnContext } from "coreblow/plugin-sdk/plugin-entry";
import { normalizeProviderId } from "coreblow/plugin-sdk/provider-model-shared";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";

type VllmThinkingLevel = ProviderWrapStreamFnContext["thinkingLevel"];
type VllmQwenThinkingFormat = "chat-template" | "top-level";

function isVllmProviderId(providerId: string): boolean {
  return normalizeProviderId(providerId) === "vllm";
}

function normalizeQwenThinkingFormat(value: unknown): VllmQwenThinkingFormat | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase().replace(/_/g, "-");
  if (
    normalized === "chat-template" ||
    normalized === "chat-template-kwargs" ||
    normalized === "chat-template-kwarg" ||
    normalized === "chat-template-arguments"
  ) {
    return "chat-template";
  }
  if (
    normalized === "top-level" ||
    normalized === "enable-thinking" ||
    normalized === "request-body"
  ) {
    return "top-level";
  }
  return undefined;
}

function resolveVllmQwenThinkingFormat(
  extraParams: ProviderWrapStreamFnContext["extraParams"],
): VllmQwenThinkingFormat | undefined {
  return normalizeQwenThinkingFormat(
    extraParams?.qwenThinkingFormat ?? extraParams?.qwen_thinking_format,
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

function isThinkingEnabled(params: { thinkingLevel: VllmThinkingLevel; options?: unknown }): boolean {
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

function isVllmNemotronModel(model: { api?: unknown; provider?: unknown; id?: unknown }): boolean {
  return (
    model.api === "openai-completions" &&
    typeof model.provider === "string" &&
    normalizeProviderId(model.provider) === "vllm" &&
    typeof model.id === "string" &&
    /\bnemotron-3(?:[-_](?:nano|super|ultra))?\b/i.test(model.id)
  );
}

function setNemotronThinkingOffChatTemplateKwargs(payload: Record<string, unknown>): void {
  const defaults = {
    enable_thinking: false,
    force_nonempty_content: true,
  };
  const existing = payload.chat_template_kwargs;
  payload.chat_template_kwargs =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? {
          ...defaults,
          ...(existing as Record<string, unknown>),
        }
      : defaults;
}

function createPayloadPatchStreamWrapper(
  baseStreamFn: StreamFn | undefined,
  patchPayload: (params: {
    payload: Record<string, unknown>;
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
      patchPayload({ payload, options });
    });
  };
}

export function createVllmQwenThinkingWrapper(params: {
  baseStreamFn: StreamFn | undefined;
  format: VllmQwenThinkingFormat;
  thinkingLevel: VllmThinkingLevel;
}): StreamFn {
  return createPayloadPatchStreamWrapper(
    params.baseStreamFn,
    ({ payload, options }) => {
      const enableThinking = isThinkingEnabled({
        thinkingLevel: params.thinkingLevel,
        options,
      });
      if (params.format === "chat-template") {
        setQwenChatTemplateThinking(payload, enableThinking);
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

export function createVllmProviderThinkingWrapper(params: {
  baseStreamFn: StreamFn | undefined;
  qwenFormat?: VllmQwenThinkingFormat;
  thinkingLevel: VllmThinkingLevel;
}): StreamFn {
  const qwenWrapped = params.qwenFormat
    ? createVllmQwenThinkingWrapper({
        baseStreamFn: params.baseStreamFn,
        format: params.qwenFormat,
        thinkingLevel: params.thinkingLevel,
      })
    : params.baseStreamFn;
  return createPayloadPatchStreamWrapper(
    qwenWrapped,
    ({ payload }) => {
      setNemotronThinkingOffChatTemplateKwargs(payload);
    },
    ({ model }) =>
      model.api === "openai-completions" &&
      params.thinkingLevel === "off" &&
      isVllmNemotronModel(model),
  );
}

export function wrapVllmProviderStream(ctx: ProviderWrapStreamFnContext): StreamFn | undefined {
  if (!isVllmProviderId(ctx.provider) || (ctx.model && ctx.model.api !== "openai-completions")) {
    return undefined;
  }
  const qwenFormat = resolveVllmQwenThinkingFormat(ctx.extraParams);
  const shouldHandleNemotron =
    ctx.thinkingLevel === "off" &&
    isVllmNemotronModel({
      api: "openai-completions",
      provider: ctx.provider,
      id: ctx.modelId,
    });
  if (!qwenFormat && !shouldHandleNemotron) {
    return undefined;
  }
  return createVllmProviderThinkingWrapper({
    baseStreamFn: ctx.streamFn,
    qwenFormat,
    thinkingLevel: ctx.thinkingLevel,
  });
}
