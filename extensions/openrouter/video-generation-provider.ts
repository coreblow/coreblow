import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import type {
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationSourceAsset,
} from "coreblow/plugin-sdk/video-generation-core";
import { OPENROUTER_BASE_URL } from "./provider-catalog.js";
import {
  buildOpenRouterVideoHeaders,
  fetchOpenRouterVideoJson,
  parseOpenRouterVideoPollResult,
} from "./video-http.js";
import {
  DEFAULT_OPENROUTER_VIDEO_MODEL,
  listOpenRouterVideoModelCatalog,
} from "./video-model-catalog.js";

const DEFAULT_OPENROUTER_VIDEO_TIMEOUT_MS = 600_000;
const OPENROUTER_VIDEO_POLL_INTERVAL_MS = 1_500;
const TERMINAL_FAILURE_STATUSES = new Set(["failed", "cancelled", "canceled", "error"]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sourceAssetToOpenRouterImage(asset: VideoGenerationSourceAsset): Record<string, unknown> {
  if (asset.url) {
    return { image_url: { url: asset.url } };
  }
  if (asset.buffer) {
    const mimeType = asset.mimeType || "image/png";
    return { image_url: { url: `data:${mimeType};base64,${asset.buffer.toString("base64")}` } };
  }
  return {};
}

export function buildOpenRouterVideoRequestBody(req: VideoGenerationRequest) {
  const model = req.model?.trim() || DEFAULT_OPENROUTER_VIDEO_MODEL;
  return {
    model,
    prompt: req.prompt,
    ...(req.durationSeconds ? { duration: req.durationSeconds } : {}),
    ...(req.resolution ? { resolution: req.resolution } : {}),
    ...(req.aspectRatio ? { aspect_ratio: req.aspectRatio } : {}),
    ...(req.size ? { size: req.size } : {}),
    ...(req.audio !== undefined ? { generate_audio: req.audio } : {}),
    ...(req.inputImages?.length
      ? { frame_images: req.inputImages.map(sourceAssetToOpenRouterImage) }
      : {}),
    ...(req.providerOptions ?? {}),
  };
}

async function resolveOpenRouterVideoUrls(params: {
  initialPayload: unknown;
  headers: Headers;
  timeoutMs: number;
}): Promise<{ taskId?: string; videos: string[] }> {
  let current = parseOpenRouterVideoPollResult(params.initialPayload);
  if (current.videos.length > 0 || !current.pollingUrl) {
    return { taskId: current.id, videos: current.videos };
  }
  const deadline = Date.now() + params.timeoutMs;
  while (Date.now() < deadline) {
    const pollingUrl = current.pollingUrl;
    if (!pollingUrl) {
      return { taskId: current.id, videos: [] };
    }
    await sleep(OPENROUTER_VIDEO_POLL_INTERVAL_MS);
    const payload = await fetchOpenRouterVideoJson({
      url: pollingUrl,
      headers: params.headers,
      init: { method: "GET" },
      errorLabel: "OpenRouter video generation poll failed",
    });
    current = parseOpenRouterVideoPollResult(payload);
    if (current.videos.length > 0) {
      return { taskId: current.id, videos: current.videos };
    }
    if (current.status && TERMINAL_FAILURE_STATUSES.has(current.status)) {
      throw new Error(`OpenRouter video generation task ended with ${current.status}`);
    }
  }
  throw new Error("OpenRouter video generation task timed out");
}

export function buildOpenRouterVideoGenerationProvider(): VideoGenerationProvider {
  const catalog = listOpenRouterVideoModelCatalog();
  return {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: DEFAULT_OPENROUTER_VIDEO_MODEL,
    models: catalog.map((entry) => entry.id),
    capabilities: {
      maxVideos: 1,
      supportedDurationSeconds: [4, 6, 8],
      aspectRatios: ["16:9", "9:16"],
      resolutions: ["720P", "1080P"],
      supportsAspectRatio: true,
      supportsResolution: true,
      supportsAudio: true,
      generate: {
        maxVideos: 1,
        supportedDurationSeconds: [4, 6, 8],
        aspectRatios: ["16:9", "9:16"],
        resolutions: ["720P", "1080P"],
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 3,
        supportedDurationSeconds: [4, 6, 8],
        aspectRatios: ["16:9", "9:16"],
        resolutions: ["720P", "1080P"],
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req) {
      const auth = await resolveApiKeyForProvider({
        provider: "openrouter",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("OpenRouter API key missing");
      }
      const headers = buildOpenRouterVideoHeaders(auth.apiKey);
      const model = req.model?.trim() || DEFAULT_OPENROUTER_VIDEO_MODEL;
      const payload = await fetchOpenRouterVideoJson({
        url: `${OPENROUTER_BASE_URL}/generation`,
        headers,
        init: {
          method: "POST",
          body: JSON.stringify(buildOpenRouterVideoRequestBody({ ...req, model })),
        },
        errorLabel: "OpenRouter video generation request failed",
      });
      const resolved = await resolveOpenRouterVideoUrls({
        initialPayload: payload,
        headers,
        timeoutMs: req.timeoutMs ?? DEFAULT_OPENROUTER_VIDEO_TIMEOUT_MS,
      });
      return {
        model,
        videos: resolved.videos.map((url, index) => ({
          url,
          mimeType: "video/mp4",
          fileName: `video-${index + 1}.mp4`,
          metadata: { taskId: resolved.taskId },
        })),
      };
    },
  };
}
