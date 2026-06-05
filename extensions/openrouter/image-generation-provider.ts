import type {
  GeneratedImageAsset,
  ImageGenerationProvider,
  ImageGenerationSourceImage,
} from "coreblow/plugin-sdk/image-generation";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, postJsonRequest } from "coreblow/plugin-sdk/provider-http";
import { OPENROUTER_BASE_URL } from "./provider-catalog.js";

export const OPENROUTER_IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
  "openai/gpt-5.4-image-2",
] as const;

const DEFAULT_OPENROUTER_IMAGE_MODEL = OPENROUTER_IMAGE_MODELS[0];
const OPENROUTER_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string } }>;
      content?: unknown;
    };
  }>;
};

function toImageDataUrl(image: ImageGenerationSourceImage): string {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

function parseDataUrl(value: string, index: number): GeneratedImageAsset | undefined {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/u.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const mimeType = match[1] || "image/png";
  const extension = mimeType.split("/")[1] || "png";
  return {
    buffer: Buffer.from(match[2] ?? "", "base64"),
    mimeType,
    fileName: `image-${index + 1}.${extension}`,
  };
}

function imageAssetFromBase64(params: {
  b64: string;
  mimeType?: string;
  index: number;
}): GeneratedImageAsset {
  const mimeType = params.mimeType || "image/png";
  const extension = mimeType.split("/")[1] || "png";
  return {
    buffer: Buffer.from(params.b64, "base64"),
    mimeType,
    fileName: `image-${params.index + 1}.${extension}`,
  };
}

function collectImageStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const matches = value.match(/data:image\/[^;\s]+;base64,[A-Za-z0-9+/=]+/gu);
    if (matches) {
      out.push(...matches);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectImageStrings(entry, out);
    }
    return;
  }
  const record = value as Record<string, unknown>;
  const imageUrl = record.image_url;
  if (typeof imageUrl === "object" && imageUrl !== null) {
    const url = (imageUrl as Record<string, unknown>).url;
    if (typeof url === "string") {
      out.push(url);
    }
  }
  if (typeof record.b64_json === "string") {
    out.push(`data:image/png;base64,${record.b64_json}`);
  }
  const inlineData = record.inlineData ?? record.inline_data;
  if (typeof inlineData === "object" && inlineData !== null) {
    const inlineRecord = inlineData as Record<string, unknown>;
    const data = inlineRecord.data;
    if (typeof data === "string") {
      const mimeType = typeof inlineRecord.mimeType === "string" ? inlineRecord.mimeType : "image/png";
      out.push(`data:${mimeType};base64,${data}`);
    }
  }
}

export function extractOpenRouterGeneratedImages(payload: OpenRouterImageResponse): GeneratedImageAsset[] {
  const imageUrls: string[] = [];
  for (const choice of payload.choices ?? []) {
    for (const image of choice.message?.images ?? []) {
      const url = image.image_url?.url;
      if (url) {
        imageUrls.push(url);
      }
    }
    collectImageStrings(choice.message?.content, imageUrls);
  }
  return imageUrls
    .map((url, index) => parseDataUrl(url, index))
    .filter((asset): asset is GeneratedImageAsset => asset !== undefined);
}

function buildImageMessages(prompt: string, inputImages?: readonly ImageGenerationSourceImage[]) {
  if (!inputImages?.length) {
    return [{ role: "user", content: prompt }];
  }
  return [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        ...inputImages.map((image) => ({
          type: "image_url",
          image_url: { url: toImageDataUrl(image) },
        })),
      ],
    },
  ];
}

export function buildOpenRouterImageRequestBody(params: {
  model: string;
  prompt: string;
  count?: number;
  aspectRatio?: string;
  size?: string;
  resolution?: string;
  inputImages?: readonly ImageGenerationSourceImage[];
}): Record<string, unknown> {
  return {
    model: params.model,
    messages: buildImageMessages(params.prompt, params.inputImages),
    modalities: ["image", "text"],
    n: Math.max(1, Math.min(params.count ?? 1, 4)),
    ...(params.aspectRatio ? { aspect_ratio: params.aspectRatio } : {}),
    ...(params.size ? { size: params.size } : {}),
    ...(params.resolution ? { resolution: params.resolution } : {}),
  };
}

export function buildOpenRouterImageGenerationProvider(): ImageGenerationProvider {
  return {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: DEFAULT_OPENROUTER_IMAGE_MODEL,
    models: [...OPENROUTER_IMAGE_MODELS],
    capabilities: {
      generate: {
        maxCount: 4,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      edit: {
        enabled: true,
        maxCount: 4,
        maxInputImages: 4,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      geometry: {
        aspectRatios: [...OPENROUTER_IMAGE_ASPECT_RATIOS],
        resolutions: ["1K", "2K", "4K"],
      },
    },
    async generateImage(req) {
      const auth = await resolveApiKeyForProvider({
        provider: "openrouter",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("OpenRouter API key missing");
      }
      const model = req.model || DEFAULT_OPENROUTER_IMAGE_MODEL;
      const { response, release } = await postJsonRequest({
        url: `${OPENROUTER_BASE_URL}/chat/completions`,
        headers: new Headers({
          Authorization: `Bearer ${auth.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://coreblow.com",
          "X-OpenRouter-Title": "CoreBlow",
        }),
        body: buildOpenRouterImageRequestBody({
          model,
          prompt: req.prompt,
          count: req.count,
          aspectRatio: req.aspectRatio,
          size: req.size,
          resolution: req.resolution,
          inputImages: req.inputImages,
        }),
        timeoutMs: req.timeoutMs ?? 120_000,
        fetchFn: fetch,
      });
      try {
        await assertOkOrThrowHttpError(response, "OpenRouter image generation failed");
        const images = extractOpenRouterGeneratedImages((await response.json()) as OpenRouterImageResponse);
        return { images, model };
      } finally {
        await release();
      }
    },
  };
}

export const openRouterImageTestApi = {
  imageAssetFromBase64,
  toImageDataUrl,
};
