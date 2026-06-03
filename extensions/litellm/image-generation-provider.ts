import type { ImageGenerationProvider, ImageGenerationSourceImage } from "coreblow/plugin-sdk/image-generation";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, postJsonRequest } from "coreblow/plugin-sdk/provider-http";
import { LITELLM_BASE_URL } from "./onboard.js";

const DEFAULT_SIZE = "1024x1024";
const DEFAULT_LITELLM_IMAGE_MODEL = "gpt-image-2";
const LITELLM_SUPPORTED_SIZES = [
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1024x1792",
  "1536x1024",
  "1792x1024",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
] as const;
const LITELLM_MAX_INPUT_IMAGES = 5;

type LitellmImageApiResponse = {
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveConfiguredLitellmBaseUrl(
  cfg: Parameters<typeof resolveApiKeyForProvider>[0]["cfg"],
): string {
  return normalizeOptionalString(cfg?.models?.providers?.litellm?.baseUrl) ?? LITELLM_BASE_URL;
}

function toImageDataUrl(image: ImageGenerationSourceImage): string {
  return `data:${image.mimeType};base64,${image.buffer.toString("base64")}`;
}

function isAutoAllowedLitellmHostname(hostname: string): boolean {
  if (!hostname) {
    return false;
  }
  const host =
    hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const lowered = host.toLowerCase();
  if (
    lowered === "localhost" ||
    lowered === "host.docker.internal" ||
    lowered.endsWith(".localhost")
  ) {
    return true;
  }
  if (lowered === "127.0.0.1" || lowered.startsWith("127.")) {
    return true;
  }
  if (lowered === "::1" || lowered === "0:0:0:0:0:0:0:1") {
    return true;
  }
  return false;
}

function shouldAutoAllowPrivateLitellmEndpoint(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return isAutoAllowedLitellmHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export function buildLitellmImageGenerationProvider(): ImageGenerationProvider {
  return {
    id: "litellm",
    label: "LiteLLM",
    defaultModel: DEFAULT_LITELLM_IMAGE_MODEL,
    models: [DEFAULT_LITELLM_IMAGE_MODEL],
    capabilities: {
      generate: {
        maxCount: 4,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      edit: {
        enabled: true,
        maxCount: 4,
        maxInputImages: LITELLM_MAX_INPUT_IMAGES,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      geometry: {
        sizes: [...LITELLM_SUPPORTED_SIZES],
      },
    },
    async generateImage(req) {
      const auth = await resolveApiKeyForProvider({
        provider: "litellm",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("LiteLLM API key missing");
      }

      const baseUrl = resolveConfiguredLitellmBaseUrl(req.cfg).replace(/\/+$/u, "");
      const allowPrivateNetwork = shouldAutoAllowPrivateLitellmEndpoint(baseUrl);
      const hasInputImages = (req.inputImages?.length ?? 0) > 0;
      const path = hasInputImages ? "/images/edits" : "/images/generations";
      const body = hasInputImages
        ? {
            model: req.model || DEFAULT_LITELLM_IMAGE_MODEL,
            prompt: req.prompt,
            n: req.count ?? 1,
            size: req.size ?? DEFAULT_SIZE,
            images: (req.inputImages ?? []).map((image) => ({
              image_url: toImageDataUrl(image),
            })),
          }
        : {
            model: req.model || DEFAULT_LITELLM_IMAGE_MODEL,
            prompt: req.prompt,
            n: req.count ?? 1,
            size: req.size ?? DEFAULT_SIZE,
          };

      const { response, release } = await postJsonRequest({
        url: `${baseUrl}${path}`,
        headers: new Headers({
          Authorization: `Bearer ${auth.apiKey}`,
          "Content-Type": "application/json",
        }),
        body,
        timeoutMs: req.timeoutMs ?? 60_000,
        fetchFn: fetch,
        allowPrivateNetwork,
      });

      try {
        await assertOkOrThrowHttpError(
          response,
          hasInputImages ? "LiteLLM image edit failed" : "LiteLLM image generation failed",
        );
        const payload = (await response.json()) as LitellmImageApiResponse;
        const images = (payload.data ?? [])
          .map((entry, index) => {
            if (!entry.b64_json) {
              return null;
            }
            return {
              buffer: Buffer.from(entry.b64_json, "base64"),
              mimeType: "image/png",
              fileName: `image-${index + 1}.png`,
              ...(entry.revised_prompt ? { revisedPrompt: entry.revised_prompt } : {}),
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
        return {
          images,
          model: req.model || DEFAULT_LITELLM_IMAGE_MODEL,
        };
      } finally {
        await release();
      }
    },
  };
}
