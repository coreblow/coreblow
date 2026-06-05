import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, normalizeBaseUrl } from "coreblow/plugin-sdk/provider-http";
import type {
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationSourceAsset,
} from "coreblow/plugin-sdk/video-generation-core";

const DEFAULT_FAL_BASE_URL = "https://fal.run";
const DEFAULT_FAL_VIDEO_MODEL = "fal-ai/minimax/video-01-live";
const SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL = "bytedance/seedance-2.0/fast/text-to-video";
const SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL = "bytedance/seedance-2.0/fast/image-to-video";

export const FAL_VIDEO_MODELS = [
  DEFAULT_FAL_VIDEO_MODEL,
  SEEDANCE_FAST_TEXT_TO_VIDEO_MODEL,
  SEEDANCE_FAST_IMAGE_TO_VIDEO_MODEL,
] as const;

function sourceAssetToUrl(asset: VideoGenerationSourceAsset): string | undefined {
  if (asset.url) {
    return asset.url;
  }
  if (asset.buffer) {
    const mimeType = asset.mimeType || "image/png";
    return `data:${mimeType};base64,${asset.buffer.toString("base64")}`;
  }
  return undefined;
}

export function buildFalVideoRequestBody(req: VideoGenerationRequest): Record<string, unknown> {
  const inputImageUrls = (req.inputImages ?? []).flatMap((asset) => {
    const url = sourceAssetToUrl(asset);
    return url ? [url] : [];
  });
  return {
    prompt: req.prompt,
    ...(req.durationSeconds ? { duration: req.durationSeconds } : {}),
    ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
    ...(req.resolution ? { resolution: req.resolution } : {}),
    ...(inputImageUrls.length === 1 ? { image_url: inputImageUrls[0] } : {}),
    ...(inputImageUrls.length > 1 ? { image_urls: inputImageUrls } : {}),
    ...(req.providerOptions ?? {}),
  };
}

function extractFalVideoUrls(payload: unknown): string[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  const record = payload as Record<string, unknown>;
  const urls: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//u.test(value)) {
      urls.push(value);
      return;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      collect(nested.url);
      collect(nested.video_url);
    }
  };
  collect(record.video);
  for (const entry of Array.isArray(record.videos) ? record.videos : []) {
    collect(entry);
  }
  collect(record.video_url);
  return [...new Set(urls)];
}

export function buildFalVideoGenerationProvider(): VideoGenerationProvider {
  return {
    id: "fal",
    label: "fal",
    defaultModel: DEFAULT_FAL_VIDEO_MODEL,
    models: [...FAL_VIDEO_MODELS],
    capabilities: {
      maxVideos: 1,
      supportedDurationSeconds: [5, 6, 7, 8, 9, 10],
      aspectRatios: ["16:9", "9:16", "1:1"],
      resolutions: ["720P", "1080P"],
      supportsAspectRatio: true,
      supportsResolution: true,
      supportsAudio: false,
      generate: {
        maxVideos: 1,
        supportedDurationSeconds: [5, 6, 7, 8, 9, 10],
        aspectRatios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        supportedDurationSeconds: [5, 6, 7, 8, 9, 10],
        aspectRatios: ["16:9", "9:16", "1:1"],
        resolutions: ["720P", "1080P"],
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req) {
      const auth = await resolveApiKeyForProvider({
        provider: "fal",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("fal API key missing");
      }
      const baseUrl = normalizeBaseUrl(req.cfg?.models?.providers?.fal?.baseUrl, DEFAULT_FAL_BASE_URL);
      const model = req.model?.trim() || DEFAULT_FAL_VIDEO_MODEL;
      const response = await fetch(`${baseUrl}/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${auth.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildFalVideoRequestBody({ ...req, model })),
      });
      await assertOkOrThrowHttpError(response, "fal video generation failed");
      const urls = extractFalVideoUrls(await response.json());
      if (urls.length === 0) {
        throw new Error("fal video generation response missing video output");
      }
      return {
        model,
        videos: urls.map((url, index) => ({
          url,
          mimeType: "video/mp4",
          fileName: `video-${index + 1}.mp4`,
        })),
      };
    },
  };
}
