import type { AuthProfileStore } from "../../src/agents/auth-profiles/types.js";
import type { CoreBlowConfig } from "../../src/config/config.js";
import { extensionForMime } from "coreblow/plugin-sdk/media-runtime";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import {
  assertOkOrThrowHttpError,
  fetchWithTimeout,
  normalizeBaseUrl,
  postJsonRequest,
} from "coreblow/plugin-sdk/provider-http";
import { TOGETHER_BASE_URL } from "./models.js";

const DEFAULT_TOGETHER_VIDEO_MODEL = "Wan-AI/Wan2.2-T2V-A14B";
const TOGETHER_VIDEO_BASE_URL = "https://api.together.xyz/v2";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

export type GeneratedTogetherVideoAsset = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type TogetherVideoGenerationSourceImage = {
  buffer?: Buffer;
  mimeType?: string;
  url?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

export type TogetherVideoGenerationRequest = {
  provider: string;
  model?: string;
  prompt: string;
  cfg: CoreBlowConfig;
  agentDir?: string;
  authStore?: AuthProfileStore;
  timeoutMs?: number;
  size?: string;
  durationSeconds?: number;
  inputImages?: TogetherVideoGenerationSourceImage[];
  inputVideos?: unknown[];
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

export type TogetherVideoGenerationResult = {
  videos: GeneratedTogetherVideoAsset[];
  model?: string;
  metadata?: Record<string, unknown>;
};

export type TogetherVideoGenerationCapabilities = {
  generate: {
    maxVideos: number;
    maxDurationSeconds: number;
    supportsSize: boolean;
  };
  imageToVideo: {
    enabled: boolean;
    maxVideos: number;
    maxInputImages: number;
    maxDurationSeconds: number;
    supportsSize: boolean;
  };
  videoToVideo: {
    enabled: boolean;
  };
};

export type TogetherVideoGenerationProvider = {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  capabilities: TogetherVideoGenerationCapabilities;
  isConfigured: (params: { agentDir?: string }) => boolean;
  generateVideo: (req: TogetherVideoGenerationRequest) => Promise<TogetherVideoGenerationResult>;
};

type TogetherVideoResponse = {
  id?: string;
  model?: string;
  status?: "in_progress" | "completed" | "failed";
  error?: {
    code?: string;
    message?: string;
  } | null;
  outputs?:
    | {
        video_url?: string;
        url?: string;
      }
    | Array<{
        video_url?: string;
        url?: string;
      }>;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

function resolveTogetherVideoBaseUrl(cfg: CoreBlowConfig): string {
  const configuredBaseUrl = normalizeOptionalString(cfg?.models?.providers?.together?.baseUrl);
  if (
    !configuredBaseUrl ||
    stripTrailingSlash(configuredBaseUrl) === stripTrailingSlash(TOGETHER_BASE_URL)
  ) {
    return TOGETHER_VIDEO_BASE_URL;
  }
  return normalizeBaseUrl(configuredBaseUrl, TOGETHER_VIDEO_BASE_URL);
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function extractTogetherVideoUrl(payload: TogetherVideoResponse): string | undefined {
  if (Array.isArray(payload.outputs)) {
    for (const entry of payload.outputs) {
      const url = normalizeOptionalString(entry.video_url) ?? normalizeOptionalString(entry.url);
      if (url) {
        return url;
      }
    }
    return undefined;
  }
  return (
    normalizeOptionalString(payload.outputs?.video_url) ??
    normalizeOptionalString(payload.outputs?.url)
  );
}

function resolveVideoFileExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  const known = extensionForMime(normalized)?.replace(/^\./u, "");
  if (known) {
    return known;
  }
  if (normalized === "video/webm") {
    return "webm";
  }
  if (normalized === "video/quicktime") {
    return "mov";
  }
  if (normalized === "video/x-matroska") {
    return "mkv";
  }
  return "mp4";
}

function resolveDeadline(timeoutMs?: number): number {
  const effective =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;
  return Date.now() + effective;
}

function resolveRemainingTimeout(deadline: number): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    throw new Error("Together video generation timed out");
  }
  return remaining;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTogetherVideo(params: {
  videoId: string;
  headers: Headers;
  baseUrl: string;
  fetchFn: typeof fetch;
  deadline: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
}): Promise<TogetherVideoResponse> {
  for (let attempt = 0; attempt < params.maxPollAttempts; attempt += 1) {
    const response = await fetchWithTimeout(
      `${params.baseUrl}/videos/${params.videoId}`,
      {
        method: "GET",
        headers: params.headers,
      },
      resolveRemainingTimeout(params.deadline),
      params.fetchFn,
    );
    await assertOkOrThrowHttpError(response, "Together video status request failed");
    const payload = (await response.json()) as TogetherVideoResponse;
    if (payload.status === "completed") {
      return payload;
    }
    if (payload.status === "failed") {
      throw new Error(
        normalizeOptionalString(payload.error?.message) ?? "Together video generation failed",
      );
    }
    if (attempt < params.maxPollAttempts - 1) {
      await sleep(Math.min(params.pollIntervalMs, resolveRemainingTimeout(params.deadline)));
    }
  }
  throw new Error(`Together video generation task ${params.videoId} did not finish in time`);
}

async function downloadTogetherVideo(params: {
  url: string;
  fetchFn: typeof fetch;
  deadline: number;
}): Promise<GeneratedTogetherVideoAsset> {
  const response = await fetchWithTimeout(
    params.url,
    { method: "GET" },
    resolveRemainingTimeout(params.deadline),
    params.fetchFn,
  );
  await assertOkOrThrowHttpError(response, "Together generated video download failed");
  const mimeType = normalizeOptionalString(response.headers.get("content-type")) ?? "video/mp4";
  const normalizedMimeType = mimeType.split(";")[0]?.trim() || "video/mp4";
  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: normalizedMimeType,
    fileName: `video-1.${resolveVideoFileExtension(normalizedMimeType)}`,
  };
}

export function buildTogetherVideoGenerationProvider(): TogetherVideoGenerationProvider {
  return {
    id: "together",
    label: "Together",
    defaultModel: DEFAULT_TOGETHER_VIDEO_MODEL,
    models: [
      DEFAULT_TOGETHER_VIDEO_MODEL,
      "Wan-AI/Wan2.2-I2V-A14B",
      "minimax/Hailuo-02",
      "Kwai/Kling-2.1-Master",
    ],
    isConfigured: () => true,
    capabilities: {
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 12,
        supportsSize: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 12,
        supportsSize: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req) {
      if ((req.inputVideos?.length ?? 0) > 0) {
        throw new Error("Together video generation does not support video reference inputs.");
      }

      const auth = await resolveApiKeyForProvider({
        provider: "together",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("Together API key missing");
      }

      const fetchFn = req.fetchFn ?? fetch;
      const baseUrl = resolveTogetherVideoBaseUrl(req.cfg);
      const deadline = resolveDeadline(req.timeoutMs);
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
      });

      const body: Record<string, unknown> = {
        model: normalizeOptionalString(req.model) ?? DEFAULT_TOGETHER_VIDEO_MODEL,
        prompt: req.prompt,
      };

      if (typeof req.durationSeconds === "number" && Number.isFinite(req.durationSeconds)) {
        body.seconds = String(Math.max(1, Math.round(req.durationSeconds)));
      }

      const size = normalizeOptionalString(req.size);
      if (size) {
        const match = /^(\d+)x(\d+)$/u.exec(size);
        if (match) {
          body.width = Number.parseInt(match[1] ?? "", 10);
          body.height = Number.parseInt(match[2] ?? "", 10);
        }
      }

      if (req.inputImages?.[0]) {
        const input = req.inputImages[0];
        const value = normalizeOptionalString(input.url)
          ? normalizeOptionalString(input.url)
          : input.buffer
            ? toDataUrl(input.buffer, normalizeOptionalString(input.mimeType) ?? "image/png")
            : undefined;
        if (!value) {
          throw new Error("Together reference image is missing image data.");
        }
        body.reference_images = [value];
      }

      const { response, release } = await postJsonRequest({
        url: `${baseUrl}/videos`,
        headers,
        body,
        timeoutMs: resolveRemainingTimeout(deadline),
        fetchFn,
      });

      try {
        await assertOkOrThrowHttpError(response, "Together video generation failed");
        const submitted = (await response.json()) as TogetherVideoResponse;
        const videoId = normalizeOptionalString(submitted.id);
        if (!videoId) {
          throw new Error("Together video generation response missing id");
        }

        const completed = await pollTogetherVideo({
          videoId,
          headers,
          baseUrl,
          fetchFn,
          deadline,
          pollIntervalMs: req.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
          maxPollAttempts: req.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS,
        });
        const videoUrl = extractTogetherVideoUrl(completed);
        if (!videoUrl) {
          throw new Error("Together video generation completed without an output URL");
        }

        const video = await downloadTogetherVideo({
          url: videoUrl,
          fetchFn,
          deadline,
        });

        return {
          videos: [video],
          model: completed.model ?? req.model ?? DEFAULT_TOGETHER_VIDEO_MODEL,
          metadata: {
            videoId,
            status: completed.status,
            videoUrl,
          },
        };
      } finally {
        await release();
      }
    },
  };
}
