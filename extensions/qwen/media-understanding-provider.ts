import {
  describeImageWithModel,
  describeImagesWithModel,
  type MediaUnderstandingProvider,
  type VideoDescriptionRequest,
  type VideoDescriptionResult,
} from "coreblow/plugin-sdk/media-understanding";
import {
  assertOkOrThrowHttpError,
  normalizeBaseUrl,
  postJsonRequest,
} from "coreblow/plugin-sdk/provider-http";
import { QWEN_STANDARD_GLOBAL_BASE_URL } from "./models.js";

const DEFAULT_QWEN_VIDEO_MODEL = "qwen-vl-max-latest";
const DEFAULT_QWEN_VIDEO_PROMPT = "Describe the video in detail.";

type QwenVideoPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

function resolveString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function coerceOpenAiCompatibleVideoText(payload: QwenVideoPayload): string | null {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const text = content
      .map((part) => part.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
    return text || null;
  }
  return null;
}

export async function describeQwenVideo(
  params: VideoDescriptionRequest,
): Promise<VideoDescriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeBaseUrl(params.baseUrl, QWEN_STANDARD_GLOBAL_BASE_URL);
  const model = resolveString(params.model, DEFAULT_QWEN_VIDEO_MODEL);
  const mime = resolveString(params.mime, "video/mp4");
  const prompt = resolveString(params.prompt, DEFAULT_QWEN_VIDEO_PROMPT);
  const headers = new Headers(params.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${params.apiKey}`);
  }

  const { response: res, release } = await postJsonRequest({
    url: `${baseUrl}/chat/completions`,
    headers,
    body: {
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "video_url",
              video_url: {
                url: `data:${mime};base64,${params.buffer.toString("base64")}`,
              },
            },
          ],
        },
      ],
    },
    timeoutMs: params.timeoutMs,
    fetchFn,
    allowPrivateNetwork: Boolean(params.baseUrl?.trim()),
  });

  try {
    await assertOkOrThrowHttpError(res, "Qwen video description failed");
    const payload = (await res.json()) as QwenVideoPayload;
    const text = coerceOpenAiCompatibleVideoText(payload);
    if (!text) {
      throw new Error("Qwen video description response missing content");
    }
    return { text, model };
  } finally {
    await release();
  }
}

export function buildQwenMediaUnderstandingProvider(): MediaUnderstandingProvider {
  return {
    id: "qwen",
    capabilities: ["image", "video"],
    defaultModels: {
      image: "qwen-vl-max-latest",
      video: DEFAULT_QWEN_VIDEO_MODEL,
    },
    autoPriority: {
      video: 15,
    },
    describeImage: describeImageWithModel,
    describeImages: describeImagesWithModel,
    describeVideo: describeQwenVideo,
  };
}
