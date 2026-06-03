import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import {
  assertOkOrThrowHttpError,
  fetchWithTimeout,
  normalizeBaseUrl,
  postJsonRequest,
} from "coreblow/plugin-sdk/provider-http";

const DEFAULT_ALIBABA_VIDEO_BASE_URL = "https://dashscope-intl.aliyuncs.com";
const DEFAULT_ALIBABA_VIDEO_MODEL = "wan2.6-t2v";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_POLL_INTERVAL_MS = 2_500;
const DEFAULT_MAX_POLL_ATTEMPTS = 120;

export const ALIBABA_VIDEO_MODELS = [
  DEFAULT_ALIBABA_VIDEO_MODEL,
  "wan2.6-i2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "wan2.7-r2v",
] as const;

export const ALIBABA_VIDEO_CAPABILITIES = {
  generate: {
    maxVideos: 1,
    maxDurationSeconds: 10,
    supportsSize: true,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsAudio: true,
    supportsWatermark: true,
  },
  imageToVideo: {
    enabled: true,
    maxVideos: 1,
    maxInputImages: 1,
    maxDurationSeconds: 10,
    supportsSize: true,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsAudio: true,
    supportsWatermark: true,
  },
  videoToVideo: {
    enabled: true,
    maxVideos: 1,
    maxInputVideos: 4,
    maxDurationSeconds: 10,
    supportsSize: true,
    supportsAspectRatio: true,
    supportsResolution: true,
    supportsAudio: true,
    supportsWatermark: true,
  },
} as const;

export type AlibabaVideoSourceAsset = {
  url?: string;
  buffer?: Buffer;
  mimeType?: string;
  fileName?: string;
  metadata?: Record<string, unknown>;
};

export type AlibabaVideoGenerationRequest = {
  provider: string;
  model?: string;
  prompt: string;
  cfg: Record<string, any>;
  agentDir?: string;
  authStore?: unknown;
  timeoutMs?: number;
  size?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  audio?: boolean;
  watermark?: boolean;
  inputImages?: AlibabaVideoSourceAsset[];
  inputVideos?: AlibabaVideoSourceAsset[];
  fetchFn?: typeof fetch;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
};

export type AlibabaGeneratedVideoAsset = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
};

export type AlibabaVideoGenerationResult = {
  videos: AlibabaGeneratedVideoAsset[];
  model?: string;
  metadata?: Record<string, unknown>;
};

export type AlibabaVideoGenerationProvider = {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  capabilities: typeof ALIBABA_VIDEO_CAPABILITIES;
  generateVideo: (req: AlibabaVideoGenerationRequest) => Promise<AlibabaVideoGenerationResult>;
};

type DashscopeVideoResponse = {
  output?: {
    task_id?: string;
    task_status?: string;
    results?: Array<{ video_url?: string }>;
    video_url?: string;
    message?: string;
  };
  message?: string;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveAlibabaVideoBaseUrl(cfg: Record<string, any>): string {
  const explicit =
    normalizeOptionalString(cfg?.models?.providers?.alibaba?.baseUrl) ??
    normalizeOptionalString(cfg?.models?.providers?.modelstudio?.baseUrl);
  return explicit ? normalizeBaseUrl(explicit, DEFAULT_ALIBABA_VIDEO_BASE_URL) : DEFAULT_ALIBABA_VIDEO_BASE_URL;
}

function resolveTimeoutMs(timeoutMs?: number): number {
  return typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_TIMEOUT_MS;
}

function resolveReferenceUrls(
  inputImages: AlibabaVideoSourceAsset[] | undefined,
  inputVideos: AlibabaVideoSourceAsset[] | undefined,
): string[] {
  return [...(inputImages ?? []), ...(inputVideos ?? [])]
    .map((asset) => normalizeOptionalString(asset.url))
    .filter((value): value is string => Boolean(value));
}

function buildDashscopeInput(req: AlibabaVideoGenerationRequest): Record<string, unknown> {
  const unsupported = [...(req.inputImages ?? []), ...(req.inputVideos ?? [])].some(
    (asset) => !normalizeOptionalString(asset.url) && asset.buffer,
  );
  if (unsupported) {
    throw new Error(
      "Alibaba Wan video generation currently requires remote http(s) URLs for reference images/videos.",
    );
  }

  const input: Record<string, unknown> = {
    prompt: req.prompt,
  };
  const references = resolveReferenceUrls(req.inputImages, req.inputVideos);
  if (references.length === 1 && (req.inputImages?.length ?? 0) === 1 && !req.inputVideos?.length) {
    input.img_url = references[0];
  } else if (references.length > 0) {
    input.reference_urls = references;
  }
  return input;
}

function buildDashscopeParameters(req: AlibabaVideoGenerationRequest): Record<string, unknown> | undefined {
  const resolutionToSize: Record<string, string> = {
    "480P": "832*480",
    "720P": "1280*720",
    "1080P": "1920*1080",
  };
  const parameters: Record<string, unknown> = {};
  const size =
    normalizeOptionalString(req.size) ??
    (normalizeOptionalString(req.resolution) ? resolutionToSize[String(req.resolution)] : undefined);
  if (size) {
    parameters.size = size;
  }
  const aspectRatio = normalizeOptionalString(req.aspectRatio);
  if (aspectRatio) {
    parameters.aspect_ratio = aspectRatio;
  }
  if (typeof req.durationSeconds === "number" && Number.isFinite(req.durationSeconds)) {
    parameters.duration = Math.max(1, Math.round(req.durationSeconds));
  } else {
    parameters.duration = DEFAULT_DURATION_SECONDS;
  }
  if (typeof req.audio === "boolean") {
    parameters.enable_audio = req.audio;
  }
  if (typeof req.watermark === "boolean") {
    parameters.watermark = req.watermark;
  }
  return Object.keys(parameters).length > 0 ? parameters : undefined;
}

function extractVideoUrls(payload: DashscopeVideoResponse): string[] {
  const urls = [
    ...(payload.output?.results?.map((entry) => normalizeOptionalString(entry.video_url)) ?? []),
    normalizeOptionalString(payload.output?.video_url),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(urls)];
}

async function pollTask(params: {
  taskId: string;
  headers: Headers;
  baseUrl: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
  pollIntervalMs: number;
  maxPollAttempts: number;
}): Promise<DashscopeVideoResponse> {
  for (let attempt = 0; attempt < params.maxPollAttempts; attempt += 1) {
    const response = await fetchWithTimeout(
      `${params.baseUrl}/api/v1/tasks/${params.taskId}`,
      {
        method: "GET",
        headers: params.headers,
      },
      params.timeoutMs,
      params.fetchFn,
    );
    await assertOkOrThrowHttpError(response, "Alibaba Wan video task poll failed");
    const payload = (await response.json()) as DashscopeVideoResponse;
    const status = normalizeOptionalString(payload.output?.task_status)?.toUpperCase();
    if (status === "SUCCEEDED") {
      return payload;
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(
        normalizeOptionalString(payload.output?.message) ??
          normalizeOptionalString(payload.message) ??
          `Alibaba Wan video generation task ${params.taskId} failed`,
      );
    }
    if (attempt < params.maxPollAttempts - 1 && params.pollIntervalMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, params.pollIntervalMs));
    }
  }
  throw new Error(`Alibaba Wan video generation task ${params.taskId} did not finish in time`);
}

async function downloadVideo(params: {
  url: string;
  fetchFn: typeof fetch;
  timeoutMs: number;
}): Promise<AlibabaGeneratedVideoAsset> {
  const response = await fetchWithTimeout(params.url, { method: "GET" }, params.timeoutMs, params.fetchFn);
  await assertOkOrThrowHttpError(response, "Alibaba Wan generated video download failed");
  const mimeType = normalizeOptionalString(response.headers.get("content-type")) ?? "video/mp4";
  const normalizedMimeType = mimeType.split(";")[0]?.trim() || "video/mp4";
  const extension = normalizedMimeType === "video/webm" ? "webm" : "mp4";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: normalizedMimeType,
    fileName: `video-1.${extension}`,
  };
}

export function buildAlibabaVideoGenerationProvider(): AlibabaVideoGenerationProvider {
  return {
    id: "alibaba",
    label: "Alibaba Model Studio",
    defaultModel: DEFAULT_ALIBABA_VIDEO_MODEL,
    models: [...ALIBABA_VIDEO_MODELS],
    capabilities: ALIBABA_VIDEO_CAPABILITIES,
    async generateVideo(req) {
      const fetchFn = req.fetchFn ?? fetch;
      const auth = await resolveApiKeyForProvider({
        provider: "modelstudio",
        cfg: req.cfg as never,
        agentDir: req.agentDir,
        store: req.authStore as never,
      });
      if (!auth.apiKey) {
        throw new Error("Alibaba Model Studio API key missing");
      }

      const baseUrl = resolveAlibabaVideoBaseUrl(req.cfg);
      const requestBaseUrl = baseUrl.replace(/\/+$/u, "");
      const timeoutMs = resolveTimeoutMs(req.timeoutMs);
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      });

      const { response, release } = await postJsonRequest({
        url: `${requestBaseUrl}/api/v1/services/aigc/video-generation/video-synthesis`,
        headers,
        body: {
          model: normalizeOptionalString(req.model) ?? DEFAULT_ALIBABA_VIDEO_MODEL,
          input: buildDashscopeInput(req),
          parameters: buildDashscopeParameters(req),
        },
        timeoutMs,
        fetchFn,
      });

      try {
        await assertOkOrThrowHttpError(response, "Alibaba Wan video generation failed");
        const submitted = (await response.json()) as DashscopeVideoResponse;
        const taskId = normalizeOptionalString(submitted.output?.task_id);
        if (!taskId) {
          throw new Error("Alibaba Wan video generation response missing task_id");
        }
        const completed = await pollTask({
          taskId,
          headers,
          baseUrl: requestBaseUrl,
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
        const urls = extractVideoUrls(completed);
        if (urls.length === 0) {
          throw new Error("Alibaba Wan video generation completed without output video URLs");
        }
        const videos = await Promise.all(urls.slice(0, 1).map((url) => downloadVideo({ url, fetchFn, timeoutMs })));
        return {
          videos,
          model: normalizeOptionalString(req.model) ?? DEFAULT_ALIBABA_VIDEO_MODEL,
          metadata: {
            taskId,
            status: normalizeOptionalString(completed.output?.task_status) ?? "SUCCEEDED",
            videoUrls: urls,
          },
        };
      } finally {
        await release();
      }
    },
  };
}
