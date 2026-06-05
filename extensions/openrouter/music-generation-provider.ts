import type { ImageGenerationSourceImage } from "coreblow/plugin-sdk/image-generation";

export const OPENROUTER_MUSIC_MODELS = [
  "google/lyria-3-pro-preview",
  "google/lyria-3-clip-preview",
] as const;

export type OpenRouterMusicGenerationRequest = {
  model?: string;
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  durationSeconds?: number;
  inputImages?: readonly ImageGenerationSourceImage[];
};

export type OpenRouterMusicGenerationProvider = {
  id: "openrouter";
  label: "OpenRouter";
  defaultModel: (typeof OPENROUTER_MUSIC_MODELS)[number];
  models: readonly string[];
  buildRequestBody: (req: OpenRouterMusicGenerationRequest) => Record<string, unknown>;
};

function toImageDataUrl(image: ImageGenerationSourceImage): string {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

export function buildOpenRouterMusicPrompt(req: OpenRouterMusicGenerationRequest): string {
  return [
    req.prompt.trim(),
    req.instrumental ? "Instrumental only." : undefined,
    req.lyrics?.trim() ? `Lyrics:\n${req.lyrics.trim()}` : undefined,
    req.durationSeconds ? `Target duration: ${req.durationSeconds} seconds.` : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");
}

export function buildOpenRouterMusicGenerationProvider(): OpenRouterMusicGenerationProvider {
  return {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: OPENROUTER_MUSIC_MODELS[0],
    models: [...OPENROUTER_MUSIC_MODELS],
    buildRequestBody: (req) => ({
      model: req.model || OPENROUTER_MUSIC_MODELS[0],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildOpenRouterMusicPrompt(req) },
            ...(req.inputImages ?? []).map((image) => ({
              type: "image_url",
              image_url: { url: toImageDataUrl(image) },
            })),
          ],
        },
      ],
      modalities: ["audio", "text"],
    }),
  };
}
