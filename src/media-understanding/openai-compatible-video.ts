import { normalizeOptionalString } from "../shared/string-coerce.js";

export type OpenAiCompatibleVideoPayload = {
  choices?: Array<{
    message?: { content?: string | Array<{ text?: string }>; reasoning_content?: string };
  }>;
};

export function resolveMediaUnderstandingString(value: string | undefined, fallback: string): string {
  return normalizeOptionalString(value) ?? fallback;
}

export function coerceOpenAiCompatibleVideoText(
  payload: OpenAiCompatibleVideoPayload,
): string | null {
  const message = payload.choices?.[0]?.message;
  if (typeof message?.content === "string") {
    return normalizeOptionalString(message.content) ?? null;
  }
  if (Array.isArray(message?.content)) {
    const text = message.content
      .map((part) => normalizeOptionalString(part.text) ?? "")
      .filter(Boolean)
      .join("\n");
    if (text) {
      return text;
    }
  }
  return normalizeOptionalString(message?.reasoning_content) ?? null;
}

export function buildOpenAiCompatibleVideoRequestBody(params: {
  model: string;
  prompt: string;
  mime: string;
  buffer: Buffer;
}) {
  return {
    model: params.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: params.prompt },
          {
            type: "video_url",
            video_url: { url: `data:${params.mime};base64,${params.buffer.toString("base64")}` },
          },
        ],
      },
    ],
  };
}
