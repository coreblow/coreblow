import { extensionForMime } from "coreblow/plugin-sdk/media-runtime";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import {
  assertOkOrThrowHttpError,
  fetchWithTimeout,
  normalizeBaseUrl,
  postJsonRequest,
} from "coreblow/plugin-sdk/provider-http";

const DEFAULT_RUNWAY_BASE_URL = "https://api.dev.runwayml.com";
const DEFAULT_RUNWAY_MODEL = "gen4.5";
const RUNWAY_API_VERSION = "2024-11-06";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const MAX_DURATION_SECONDS = 10;

const TEXT_ONLY_MODELS = new Set(["gen4.5", "veo3.1", "veo3.1_fast", "veo3"]);
const IMAGE_MODELS = new Set([
  "gen4.5",
  "gen4_turbo",
  "gen3a_turbo",
  "veo3.1",
  "veo3.1_fast",
  "veo3",
]);
const VIDEO_MODELS = new Set(["gen4_aleph"]);

export const RUNWAY_VIDEO_CAPABILITIES = {
  generate: {
    maxVideos: 1,
    maxDurationSeconds: 10,
    supportsAspectRatio: true,
    supportsSize: true,
  },
  imageToVideo: {
    enabled: true,
    maxVideos: 1,
    maxInputImages: 1,
    maxDurationSeconds: 10,
    supportsAspectRatio: true,
    supportsSize: true,
  },
  videoToVideo: {
    enabled: true,
    maxVideos: 1,
    maxInputVideos: 1,
    supportsAspectRatio: true,
    supportsSize: true,
  },
} as const;

export type RunwaySourceAsset = {
  url?: string;
  buffer?: Buffer;
  mimeType?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

export type RunwayVideoGenerationRequest = {
  provider: string;
  model?: string;
  prompt: string;
  cfg: Record<string, unknown>;
  agentDir?: string;
  authStore?: unknown;
  timeoutMs?: number;
  size?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  inputImages?: RunwaySourceAsset[];
  inputVideos?: RunwaySourceAsset[];
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

export type RunwayGeneratedVideoAsset = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type RunwayVideoGenerationResult = {
  videos: RunwayGeneratedVideoAsset[];
  model?: string;
  metadata?: Record<string, unknown>;
};

export type RunwayVideoGenerationProvider = {
  id: string;
  label: string;
  defaultModel: string;
  capabilities: typeof RUNWAY_VIDEO_CAPABILITIES;
  generateVideo: (req: RunwayVideoGenerationRequest) => Promise<RunwayVideoGenerationResult>;
};

type RunwayTaskStatus = "PENDING" | "RUNNING" | "THROTTLED" | "SUCCEEDED" | "FAILED" | "CANCELLED";

type RunwayTaskCreateResponse = {
  id?: unknown;
};

type RunwayTaskDetailResponse = {
  id?: unknown;
  status?: unknown;
  output?: unknown;
  failure?: unknown;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readRunwayJsonResponse<T>(
  response: Pick<Response, "json">,
  label: string,
): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new Error(`${label}: malformed JSON response`, { cause });
  }
  if (!isRecord(payload)) {
    throw new Error(`${label}: malformed JSON response`);
  }
  return payload as T;
}

function readRunwayTaskStatus(payload: RunwayTaskDetailResponse): RunwayTaskStatus {
  const status = normalizeOptionalString(payload.status);
  switch (status) {
    case "PENDING":
    case "RUNNING":
    case "THROTTLED":
    case "SUCCEEDED":
    case "FAILED":
    case "CANCELLED":
      return status;
    case undefined:
      throw new Error("Runway video status response missing task status");
    default:
      throw new Error(`Runway video status response returned unknown task status: ${status}`);
  }
}

function readRunwayFailureMessage(failure: unknown): string | undefined {
  if (typeof failure === "string") {
    return normalizeOptionalString(failure);
  }
  if (isRecord(failure)) {
    return normalizeOptionalString(failure.message);
  }
  return undefined;
}

function readRunwayOutputUrls(payload: RunwayTaskDetailResponse): string[] {
  if (!Array.isArray(payload.output)) {
    throw new Error("Runway video generation completed with malformed output URLs");
  }
  const urls = payload.output
    .map((value) => normalizeOptionalString(value))
    .filter((value): value is string => Boolean(value));
  if (!urls.length) {
    throw new Error("Runway video generation completed without output URLs");
  }
  return urls;
}

function resolveRunwayBaseUrl(cfg: Record<string, unknown>): string {
  const explicit = normalizeOptionalString(
    (cfg.models as { providers?: { runway?: { baseUrl?: string } } } | undefined)?.providers?.runway
      ?.baseUrl,
  );
  return explicit ? normalizeBaseUrl(explicit, DEFAULT_RUNWAY_BASE_URL) : DEFAULT_RUNWAY_BASE_URL;
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function resolveSourceUri(asset: RunwaySourceAsset | undefined, fallbackMimeType: string): string | undefined {
  if (!asset) {
    return undefined;
  }
  const url = normalizeOptionalString(asset.url);
  if (url) {
    return url;
  }
  if (!asset.buffer) {
    return undefined;
  }
  return toDataUrl(asset.buffer, normalizeOptionalString(asset.mimeType) ?? fallbackMimeType);
}

function resolveDurationSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 5;
  }
  return Math.max(2, Math.min(MAX_DURATION_SECONDS, Math.round(value)));
}

function resolveRunwayRatio(req: RunwayVideoGenerationRequest): string {
  const hasImageInput = (req.inputImages?.length ?? 0) > 0;
  const requested =
    normalizeOptionalString(req.size) ||
    (() => {
      switch (normalizeOptionalString(req.aspectRatio)) {
        case "9:16":
          return "720:1280";
        case "16:9":
          return "1280:720";
        case "1:1":
          return "960:960";
        case "3:4":
          return "832:1104";
        case "4:3":
          return "1104:832";
        case "21:9":
          return "1584:672";
        default:
          return undefined;
      }
    })();
  if (requested) {
    if (!hasImageInput && requested !== "1280:720" && requested !== "720:1280") {
      throw new Error("Runway text-to-video currently supports only 16:9 or 9:16 output ratios.");
    }
    return requested;
  }
  return "1280:720";
}

function resolveEndpoint(
  req: RunwayVideoGenerationRequest,
): "/v1/text_to_video" | "/v1/image_to_video" | "/v1/video_to_video" {
  const imageCount = req.inputImages?.length ?? 0;
  const videoCount = req.inputVideos?.length ?? 0;
  if (imageCount > 0 && videoCount > 0) {
    throw new Error("Runway video generation does not support image and video inputs together.");
  }
  if (imageCount > 1 || videoCount > 1) {
    throw new Error("Runway video generation supports at most one input image or one input video.");
  }
  if (videoCount > 0) {
    return "/v1/video_to_video";
  }
  if (imageCount > 0) {
    return "/v1/image_to_video";
  }
  return "/v1/text_to_video";
}

function buildCreateBody(req: RunwayVideoGenerationRequest): Record<string, unknown> {
  const endpoint = resolveEndpoint(req);
  const duration = resolveDurationSeconds(req.durationSeconds);
  const ratio = resolveRunwayRatio(req);
  const model = normalizeOptionalString(req.model) ?? DEFAULT_RUNWAY_MODEL;
  if (endpoint === "/v1/text_to_video") {
    if (!TEXT_ONLY_MODELS.has(model)) {
      throw new Error(
        `Runway text-to-video does not support model ${model}. Use one of: ${[...TEXT_ONLY_MODELS].join(", ")}.`,
      );
    }
    return {
      model,
      promptText: req.prompt,
      ratio,
      duration,
    };
  }

  if (endpoint === "/v1/image_to_video") {
    if (!IMAGE_MODELS.has(model)) {
      throw new Error(
        `Runway image-to-video does not support model ${model}. Use one of: ${[...IMAGE_MODELS].join(", ")}.`,
      );
    }
    const promptImage = resolveSourceUri(req.inputImages?.[0], "image/png");
    if (!promptImage) {
      throw new Error("Runway image-to-video input is missing image data.");
    }
    return {
      model,
      promptText: req.prompt,
      promptImage,
      ratio,
      duration,
    };
  }

  if (!VIDEO_MODELS.has(model)) {
    throw new Error("Runway video-to-video currently requires model gen4_aleph.");
  }
  const videoUri = resolveSourceUri(req.inputVideos?.[0], "video/mp4");
  if (!videoUri) {
    throw new Error("Runway video-to-video input is missing video data.");
  }
  return {
    model,
    promptText: req.prompt,
    videoUri,
    ratio,
  };
}

async function pollRunwayTask(params: {
  taskId: string;
  headers: Headers;
  timeoutMs: number;
  baseUrl: string;
  fetchFn: typeof fetch;
  pollIntervalMs: number;
  maxPollAttempts: number;
}): Promise<RunwayTaskDetailResponse> {
  for (let attempt = 0; attempt < params.maxPollAttempts; attempt += 1) {
    const response = await fetchWithTimeout(
      `${params.baseUrl}/v1/tasks/${params.taskId}`,
      {
        method: "GET",
        headers: params.headers,
      },
      params.timeoutMs,
      params.fetchFn,
    );
    const payload = await readRunwayJsonResponse<RunwayTaskDetailResponse>(
      response,
      "Runway video status request failed",
    );
    const status = readRunwayTaskStatus(payload);
    switch (status) {
      case "SUCCEEDED":
        return payload;
      case "FAILED":
      case "CANCELLED":
        throw new Error(
          readRunwayFailureMessage(payload.failure) ??
            `Runway video generation ${String(status).toLowerCase()}`,
        );
      case "PENDING":
      case "RUNNING":
      case "THROTTLED":
      default:
        if (attempt < params.maxPollAttempts - 1 && params.pollIntervalMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
        }
        break;
    }
  }
  throw new Error(`Runway video generation task ${params.taskId} did not finish in time`);
}

async function downloadRunwayVideo(params: {
  url: string;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<RunwayGeneratedVideoAsset> {
  const response = await fetchWithTimeout(
    params.url,
    { method: "GET" },
    params.timeoutMs,
    params.fetchFn,
  );
  await assertOkOrThrowHttpError(response, "Runway generated video download failed");
  const mimeType = normalizeOptionalString(response.headers.get("content-type")) ?? "video/mp4";
  const normalizedMimeType = mimeType.split(";")[0]?.trim() || "video/mp4";
  const extension =
    extensionForMime(normalizedMimeType)?.replace(/^\./u, "") ||
    (normalizedMimeType === "video/webm" ? "webm" : "mp4");
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: normalizedMimeType,
    fileName: `video-1.${extension}`,
  };
}

export function buildRunwayVideoGenerationProvider(): RunwayVideoGenerationProvider {
  return {
    id: "runway",
    label: "Runway",
    defaultModel: DEFAULT_RUNWAY_MODEL,
    capabilities: RUNWAY_VIDEO_CAPABILITIES,
    async generateVideo(req) {
      const fetchFn = req.fetchFn ?? fetch;
      const auth = await resolveApiKeyForProvider({
        provider: "runway",
        cfg: req.cfg as never,
        agentDir: req.agentDir,
        store: req.authStore as never,
      });
      if (!auth.apiKey) {
        throw new Error("Runway API key missing");
      }
      const timeoutMs =
        typeof req.timeoutMs === "number" && Number.isFinite(req.timeoutMs) && req.timeoutMs > 0
          ? req.timeoutMs
          : DEFAULT_TIMEOUT_MS;
      const baseUrl = resolveRunwayBaseUrl(req.cfg).replace(/\/+$/u, "");
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
        "X-Runway-Version": RUNWAY_API_VERSION,
      });
      const endpoint = resolveEndpoint(req);
      const { response, release } = await postJsonRequest({
        url: `${baseUrl}${endpoint}`,
        headers,
        body: buildCreateBody(req),
        timeoutMs,
        fetchFn,
      });
      try {
        await assertOkOrThrowHttpError(response, "Runway video generation failed");
        const created = await readRunwayJsonResponse<RunwayTaskCreateResponse>(
          response,
          "Runway video generation failed",
        );
        const taskId = normalizeOptionalString(created.id);
        if (!taskId) {
          throw new Error("Runway video generation failed: missing task id");
        }
        const completed = await pollRunwayTask({
          taskId,
          headers,
          timeoutMs,
          baseUrl,
          fetchFn,
          pollIntervalMs:
            typeof req.pollIntervalMs === "number" && Number.isFinite(req.pollIntervalMs)
              ? Math.max(0, Math.floor(req.pollIntervalMs))
              : DEFAULT_POLL_INTERVAL_MS,
          maxPollAttempts:
            typeof req.maxPollAttempts === "number" && Number.isFinite(req.maxPollAttempts)
              ? Math.max(1, Math.floor(req.maxPollAttempts))
              : DEFAULT_MAX_POLL_ATTEMPTS,
        });
        const outputUrls = readRunwayOutputUrls(completed);
        const videos = await Promise.all(
          outputUrls.slice(0, 1).map((url) => downloadRunwayVideo({ url, timeoutMs, fetchFn })),
        );
        return {
          videos,
          model: normalizeOptionalString(req.model) ?? DEFAULT_RUNWAY_MODEL,
          metadata: {
            taskId,
            status: readRunwayTaskStatus(completed),
            endpoint,
          },
        };
      } finally {
        await release();
      }
    },
  };
}
