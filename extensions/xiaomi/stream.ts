import type { StreamFn } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import { streamWithPayloadPatch } from "coreblow/plugin-sdk/provider-stream";
import { isMiMoReasoningModelRef } from "./thinking.js";

const MIMO_REASONING_AS_VISIBLE_TEXT_MODEL_IDS = new Set(["mimo-v2-pro", "mimo-v2-omni"]);

function normalizeMiMoModelId(modelId: unknown): string | undefined {
  if (typeof modelId !== "string") {
    return undefined;
  }
  const normalized = modelId.trim().toLowerCase().split(":", 1)[0];
  if (!normalized) {
    return undefined;
  }
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? normalized;
}

function shouldPromoteMiMoReasoningToVisibleText(model: { provider?: unknown; id?: unknown }): boolean {
  return (
    model.provider === "xiaomi" &&
    MIMO_REASONING_AS_VISIBLE_TEXT_MODEL_IDS.has(normalizeMiMoModelId(model.id) ?? "")
  );
}

function patchThinkingPayload(payload: Record<string, unknown>, disabled: boolean) {
  payload.thinking = { type: disabled ? "disabled" : "enabled" };
}

function readReasoningText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }
  for (const item of content) {
    if (
      item &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "thinking" &&
      typeof (item as { thinking?: unknown }).thinking === "string"
    ) {
      const text = (item as { thinking: string }).thinking.trim();
      if (text) {
        return text;
      }
    }
  }
  return undefined;
}

function hasVisibleText(content: unknown): boolean {
  return (
    Array.isArray(content) &&
    content.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "text" &&
        typeof (item as { text?: unknown }).text === "string" &&
        (item as { text: string }).text.trim(),
    )
  );
}

function hasToolCalls(message: Record<string, unknown>): boolean {
  return Array.isArray(message.tool_calls) && message.tool_calls.length > 0;
}

function patchReplayMessages(payload: Record<string, unknown>, disabled: boolean) {
  if (!Array.isArray(payload.messages)) {
    return;
  }

  payload.messages = payload.messages.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }
    const message = { ...(entry as Record<string, unknown>) };
    if (message.role !== "assistant" || !hasToolCalls(message)) {
      return message;
    }
    const reasoning = readReasoningText(message.content);
    if (disabled) {
      delete message.reasoning_content;
      return message;
    }
    message.reasoning_content = reasoning ?? "";
    return message;
  });
}

function promoteReasoningOnlyMessage(message: unknown): unknown {
  if (!message || typeof message !== "object") {
    return message;
  }
  const next = { ...(message as Record<string, unknown>) };
  const content = next.content;
  const reasoning = readReasoningText(content);
  if (!reasoning || hasVisibleText(content) || hasToolCalls(next)) {
    return message;
  }
  next.content = [{ type: "text", text: reasoning }];
  return next;
}

function wrapResultStreamForMiMo(
  stream: ReturnType<StreamFn>,
  shouldPromote: boolean,
): ReturnType<StreamFn> {
  if (!shouldPromote || !stream || typeof stream !== "object") {
    return stream;
  }

  const maybeStream = stream as {
    result?: () => Promise<unknown>;
    [Symbol.asyncIterator]?: () => AsyncIterator<unknown>;
  };
  if (typeof maybeStream.result !== "function" || typeof maybeStream[Symbol.asyncIterator] !== "function") {
    return stream;
  }

  return {
    ...maybeStream,
    async result() {
      return promoteReasoningOnlyMessage(await maybeStream.result!());
    },
    [Symbol.asyncIterator]: () => {
      const iterator = maybeStream[Symbol.asyncIterator]!();
      return {
        async next() {
          const next = await iterator.next();
          if (next.done) {
            return next;
          }
          const value = next.value;
          if (
            value &&
            typeof value === "object" &&
            (value as { type?: unknown }).type === "message_end" &&
            (value as { message?: unknown }).message
          ) {
            return {
              ...next,
              value: {
                ...(value as Record<string, unknown>),
                message: promoteReasoningOnlyMessage((value as { message: unknown }).message),
              },
            };
          }
          return next;
        },
      } as AsyncIterator<unknown>;
    },
  } as ReturnType<StreamFn>;
}

export function createMiMoThinkingWrapper(
  baseStreamFn: StreamFn | undefined,
  thinkingLevel: unknown,
): StreamFn {
  const underlying = baseStreamFn ?? streamSimple;
  return async (model, context, options) => {
    const disabled = thinkingLevel === "off" || thinkingLevel === "none";
    const shouldPatch = isMiMoReasoningModelRef(model as { provider?: string; id?: unknown });
    const shouldPromote = shouldPromoteMiMoReasoningToVisibleText(model as { provider?: unknown; id?: unknown });

    const stream = streamWithPayloadPatch(
      underlying,
      model,
      context,
      options,
      (payload) => {
        if (!shouldPatch) {
          return;
        }
        patchThinkingPayload(payload, disabled);
        patchReplayMessages(payload, disabled);
      },
    );

    return wrapResultStreamForMiMo(stream, shouldPromote);
  };
}
