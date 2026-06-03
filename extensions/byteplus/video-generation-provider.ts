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
import { BYTEPLUS_BASE_URL } from "./models.js";

const DEFAULT_BYTEPLUS_VIDEO_MODEL = "seedance-1-0-lite-t2v-250428";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;
const DEFAULT_RESOLUTION = "480p";

export type BytePlusVideoSourceAsset = {
  url?: string;
  buffer?: Buffer;
  mimeType?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

export type BytePlusVideoGenerationRequest = {
  provider: string;
  model?: string;
  prompt: string;
  cfg: CoreBlowConfig;
  agentDir?: string;
  authStore?: AuthProfileStore;
  timeoutMs?: number;
  resolution?: string;
  inputImages?: BytePlusVideoSourceAsset[];
  inputVideos?: BytePlusVideoSourceAsset[];
  providerOptions?: Record<string, unknown>;
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

export type BytePlusGeneratedVideoAsset = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type BytePlusVideoGenerationResult = {
  videos: BytePlusGeneratedVideoAsset[];
  model?: string;
  metadata?: Record<string, unknown>;
};

export type BytePlusVideoGenerationCapabilities = {
  providerOptions: {
    seed: "number";
    draft: "boolean";
    camera_fixed: "boolean";
  };
  generate: {
    maxVideos: number;
    maxDurationSeconds: number;
    supportsAspectRatio: boolean;
    supportsResolution: boolean;
    supportsAudio: boolean;
    supportsWatermark: boolean;
  };
  imageToVideo: {
    enabled: boolean;
    maxVideos: number;
    maxInputImages: number;
    maxDurationSeconds: number;
    supportsAspectRatio: boolean;
    supportsResolution: boolean;
    supportsAudio: boolean;
    supportsWatermark: boolean;
  };
  videoToVideo: {
    enabled: boolean;
  };
};

export type BytePlusVideoGenerationProvider = {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  capabilities: BytePlusVideoGenerationCapabilities;
  isConfigured: (params: { agentDir?: string }) => boolean;
  generateVideo: (req: BytePlusVideoGenerationRequest) => Promise<BytePlusVideoGenerationResult>;
};

type BytePlusTaskCreateResponse = {
  id?: unknown;
};

type BytePlusTaskResponse = {
  id?: unknown;
  model?: unknown;
  status?: unknown;
  error?: unknown;
  content?: unknown;
  duration?: unknown;
  ratio?: unknown;
  resolution?: unknown;
};

type BytePlusTaskStatus = "running" | "failed" | "queued" | "succeeded" | "cancelled";

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveTimeoutMs(timeoutMs?: number): number {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
}

async function readBytePlusJsonResponse<T>(
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

function readBytePlusTaskStatus(payload: BytePlusTaskResponse): BytePlusTaskStatus {
  const status = normalizeOptionalString(payload.status);
  switch (status) {
    case "running":
    case "failed":
    case "queued":
    case "succeeded":
    case "cancelled":
      return status;
    case undefined:
      throw new Error("BytePlus video status response missing task status");
    default:
      throw new Error(`BytePlus video status response returned unknown task status: ${status}`);
  }
}

function readBytePlusErrorMessage(error: unknown): string | undefined {
  return isRecord(error) ? normalizeOptionalString(error.message) : undefined;
}

function readBytePlusVideoUrl(payload: BytePlusTaskResponse): string {
  const content = payload.content;
  if (content !== undefined && !isRecord(content)) {
    throw new Error("BytePlus video generation completed with malformed content");
  }
  const videoUrl = normalizeOptionalString(content?.video_url);
  if (!videoUrl) {
    throw new Error("BytePlus video generation completed without a video URL");
  }
  return videoUrl;
}

function resolveBytePlusBaseUrl(cfg: CoreBlowConfig): string {
  const explicit = normalizeOptionalString(cfg?.models?.providers?.byteplus?.baseUrl);
  return explicit ? normalizeBaseUrl(explicit, BYTEPLUS_BASE_URL) : BYTEPLUS_BASE_URL;
}

function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function resolveBytePlusImageUrl(req: BytePlusVideoGenerationRequest): string | undefined {
  const input = req.inputImages?.[0];
  if (!input) {
    return undefined;
  }
  const inputUrl = normalizeOptionalString(input.url);
  if (inputUrl) {
    return inputUrl;
  }
  if (!input.buffer) {
    throw new Error("BytePlus reference image is missing image data.");
  }
  return toDataUrl(input.buffer, normalizeOptionalString(input.mimeType) ?? "image/png");
}

function normalizeResolution(value: string | undefined): string {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  return normalized ?? DEFAULT_RESOLUTION;
}

function resolveRequestedModel(req: BytePlusVideoGenerationRequest): string {
  const requestedModel = normalizeOptionalString(req.model) ?? DEFAULT_BYTEPLUS_VIDEO_MODEL;
  if ((req.inputImages?.length ?? 0) === 0) {
    return requestedModel;
  }
  return requestedModel.includes("-t2v-")
    ? requestedModel.replace("-t2v-", "-i2v-")
    : requestedModel;
}

function buildRequestContent(req: BytePlusVideoGenerationRequest): Array<Record<string, unknown>> {
  const imageUrl = resolveBytePlusImageUrl(req);
  const content: Array<Record<string, unknown>> = [{ type: "text", text: req.prompt }];
  if (imageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
      role: "first_frame",
    });
  }
  return content;
}

function buildRequestBody(req: BytePlusVideoGenerationRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: resolveRequestedModel(req),
    resolution: normalizeResolution(req.resolution),
    content: buildRequestContent(req),
  };
  const providerOptions = req.providerOptions;
  if (providerOptions && typeof providerOptions.seed === "number" && Number.isFinite(providerOptions.seed)) {
    body.seed = providerOptions.seed;
  }
  if (providerOptions && typeof providerOptions.draft === "boolean") {
    body.draft = providerOptions.draft;
  }
  if (providerOptions && typeof providerOptions.camera_fixed === "boolean") {
    body.camera_fixed = providerOptions.camera_fixed;
  }
  return body;
}

async function pollTask(params: {
  taskId: string;
  headers: Headers;
  baseUrl: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
}): Promise<BytePlusTaskResponse> {
  for (let attempt = 0; attempt < params.maxPollAttempts; attempt += 1) {
    const response = await fetchWithTimeout(
      `${params.baseUrl}/contents/generations/tasks/${params.taskId}`,
      {
        method: "GET",
        headers: params.headers,
      },
      params.timeoutMs,
      params.fetchFn,
    );
    await assertOkOrThrowHttpError(response, "BytePlus video status request failed");
    const payload = await readBytePlusJsonResponse<BytePlusTaskResponse>(
      response,
      "BytePlus video status request failed",
    );
    switch (readBytePlusTaskStatus(payload)) {
      case "succeeded":
        return payload;
      case "failed":
      case "cancelled":
        throw new Error(readBytePlusErrorMessage(payload.error) ?? "BytePlus video generation failed");
      case "queued":
      case "running":
      default:
        if (attempt < params.maxPollAttempts - 1 && params.pollIntervalMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
        }
        break;
    }
  }
  throw new Error(`BytePlus video generation task ${params.taskId} did not finish in time`);
}

async function downloadVideo(params: {
  url: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<BytePlusGeneratedVideoAsset> {
  const response = await fetchWithTimeout(params.url, { method: "GET" }, params.timeoutMs, params.fetchFn);
  await assertOkOrThrowHttpError(response, "BytePlus generated video download failed");
  const mimeType = normalizeOptionalString(response.headers.get("content-type")) ?? "video/mp4";
  const normalizedMimeType = mimeType.split(";")[0]?.trim() || "video/mp4";
  const extension =
    extensionForMime(normalizedMimeType)?.replace(/^\./u, "") ??
    (normalizedMimeType === "video/webm" ? "webm" : "mp4");
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: normalizedMimeType,
    fileName: `video-1.${extension}`,
  };
}

export function buildBytePlusVideoGenerationProvider(): BytePlusVideoGenerationProvider {
  return {
    id: "byteplus",
    label: "BytePlus",
    defaultModel: DEFAULT_BYTEPLUS_VIDEO_MODEL,
    models: [
      DEFAULT_BYTEPLUS_VIDEO_MODEL,
      "seedance-1-0-lite-i2v-250428",
      "seedance-1-0-pro-250528",
      "seedance-1-5-pro-251215",
    ],
    isConfigured: () => true,
    capabilities: {
      providerOptions: {
        seed: "number",
        draft: "boolean",
        camera_fixed: "boolean",
      },
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 12,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 12,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req) {
      if ((req.inputVideos?.length ?? 0) > 0) {
        throw new Error("BytePlus video generation does not support video reference inputs.");
      }

      const auth = await resolveApiKeyForProvider({
        provider: "byteplus",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("BytePlus API key missing");
      }

      const fetchFn = req.fetchFn ?? fetch;
      const timeoutMs = resolveTimeoutMs(req.timeoutMs);
      const baseUrl = resolveBytePlusBaseUrl(req.cfg).replace(/\/+$/u, "");
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
      });

      const { response, release } = await postJsonRequest({
        url: `${baseUrl}/contents/generations/tasks`,
        headers,
        body: buildRequestBody(req),
        timeoutMs,
        fetchFn,
      });

      try {
        await assertOkOrThrowHttpError(response, "BytePlus video generation failed");
        const submitted = await readBytePlusJsonResponse<BytePlusTaskCreateResponse>(
          response,
          "BytePlus video generation failed",
        );
        const taskId = normalizeOptionalString(submitted.id);
        if (!taskId) {
          throw new Error("BytePlus video generation response missing task id");
        }

        const completed = await pollTask({
          taskId,
          headers,
          baseUrl,
          fetchFn,
          timeoutMs,
          pollIntervalMs:
            typeof req.pollIntervalMs === "number" && Number.isFinite(req.pollIntervalMs)
              ? Math.max(0, Math.floor(req.pollIntervalMs))
              : DEFAULT_POLL_INTERVAL_MS,
          maxPollAttempts:
            typeof req.maxPollAttempts === "number" && Number.isFinite(req.maxPollAttempts)
              ? Math.max(1, Math.floor(req.maxPollAttempts))
              : DEFAULT_MAX_POLL_ATTEMPTS,
        });
        const videoUrl = readBytePlusVideoUrl(completed);
        const video = await downloadVideo({
          url: videoUrl,
          fetchFn,
          timeoutMs,
        });
        return {
          videos: [video],
          model: normalizeOptionalString(completed.model) ?? resolveRequestedModel(req),
          metadata: {
            taskId,
            videoUrl,
            status: readBytePlusTaskStatus(completed),
            resolution: normalizeOptionalString(completed.resolution) ?? normalizeResolution(req.resolution),
          },
        };
      } finally {
        await release();
      }
    },
  };
}
