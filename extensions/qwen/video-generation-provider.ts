import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, normalizeBaseUrl } from "coreblow/plugin-sdk/provider-http";
import type {
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationResult,
} from "coreblow/plugin-sdk/video-generation-core";
import { QWEN_STANDARD_CN_BASE_URL, QWEN_STANDARD_GLOBAL_BASE_URL } from "./models.js";

const DEFAULT_QWEN_VIDEO_BASE_URL = "https://dashscope-intl.aliyuncs.com";
const DEFAULT_QWEN_VIDEO_MODEL = "wan2.6-t2v";
const DEFAULT_QWEN_VIDEO_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 1_500;

export const QWEN_VIDEO_GENERATION_MODELS = [
  "wan2.6-t2v",
  "wan2.6-i2v",
  "wan2.5-t2v",
  "wan2.5-i2v",
] as const;

function resolveQwenVideoBaseUrl(req: VideoGenerationRequest): string {
  const direct = req.cfg?.models?.providers?.qwen?.baseUrl?.trim();
  if (!direct) {
    return DEFAULT_QWEN_VIDEO_BASE_URL;
  }
  try {
    return new URL(direct).toString();
  } catch {
    return DEFAULT_QWEN_VIDEO_BASE_URL;
  }
}

function resolveDashscopeAigcApiBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl);
    if (
      url.hostname === "coding-intl.dashscope.aliyuncs.com" ||
      url.hostname === "coding.dashscope.aliyuncs.com" ||
      url.hostname === "dashscope-intl.aliyuncs.com" ||
      url.hostname === "dashscope.aliyuncs.com"
    ) {
      return url.origin;
    }
  } catch {
    // Fall through to legacy prefix handling for non-URL strings.
  }
  if (baseUrl.startsWith(QWEN_STANDARD_CN_BASE_URL)) {
    return "https://dashscope.aliyuncs.com";
  }
  if (baseUrl.startsWith(QWEN_STANDARD_GLOBAL_BASE_URL)) {
    return DEFAULT_QWEN_VIDEO_BASE_URL;
  }
  return baseUrl.replace(/\/+$/u, "");
}

function buildDashscopeVideoPayload(req: VideoGenerationRequest, model: string) {
  return {
    model,
    input: {
      prompt: req.prompt,
      ...(req.inputImages?.[0]?.url ? { img_url: req.inputImages[0].url } : {}),
    },
    parameters: {
      ...(req.size ? { size: req.size } : {}),
      ...(req.durationSeconds ? { duration: req.durationSeconds } : {}),
      ...(req.watermark !== undefined ? { watermark: req.watermark } : {}),
      ...(req.resolution ? { resolution: req.resolution } : {}),
      ...(req.providerOptions ?? {}),
    },
  };
}

function coerceTaskId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const record = payload as Record<string, unknown>;
  const output = record.output;
  if (typeof record.task_id === "string") {
    return record.task_id;
  }
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const taskId = (output as Record<string, unknown>).task_id;
    return typeof taskId === "string" ? taskId : undefined;
  }
  return undefined;
}

function coerceVideoUrl(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const output = (payload as Record<string, unknown>).output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  const outputRecord = output as Record<string, unknown>;
  if (typeof outputRecord.video_url === "string") {
    return outputRecord.video_url;
  }
  const results = outputRecord.results;
  if (Array.isArray(results)) {
    const first = results.find((entry) => entry && typeof entry === "object");
    const url = first ? (first as Record<string, unknown>).url : undefined;
    return typeof url === "string" ? url : undefined;
  }
  return undefined;
}

function coerceTaskStatus(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const output = (payload as Record<string, unknown>).output;
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return undefined;
  }
  const status = (output as Record<string, unknown>).task_status;
  return typeof status === "string" ? status.toUpperCase() : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollDashscopeVideoTask(params: {
  baseUrl: string;
  taskId: string;
  headers: Headers;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<string> {
  const deadline = Date.now() + params.timeoutMs;
  while (Date.now() < deadline) {
    const res = await params.fetchFn(`${params.baseUrl}/api/v1/tasks/${params.taskId}`, {
      method: "GET",
      headers: params.headers,
    });
    await assertOkOrThrowHttpError(res, "Qwen video generation poll failed");
    const payload = (await res.json()) as unknown;
    const url = coerceVideoUrl(payload);
    if (url) {
      return url;
    }
    const status = coerceTaskStatus(payload);
    if (status === "FAILED" || status === "CANCELED" || status === "UNKNOWN") {
      throw new Error(`Qwen video generation task ${params.taskId} ended with ${status}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Qwen video generation task ${params.taskId} timed out`);
}

export function buildQwenVideoGenerationProvider(): VideoGenerationProvider {
  return {
    id: "qwen",
    label: "Qwen Cloud",
    defaultModel: DEFAULT_QWEN_VIDEO_MODEL,
    models: [...QWEN_VIDEO_GENERATION_MODELS],
    capabilities: {
      maxVideos: 1,
      supportedDurationSeconds: [5, 10],
      sizes: ["1280*720", "720*1280", "1024*1024"],
      supportsSize: true,
      supportsResolution: true,
      supportsWatermark: true,
      generate: {
        maxVideos: 1,
        supportedDurationSeconds: [5, 10],
        sizes: ["1280*720", "720*1280", "1024*1024"],
        supportsSize: true,
        supportsResolution: true,
        supportsWatermark: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        supportedDurationSeconds: [5, 10],
        sizes: ["1280*720", "720*1280", "1024*1024"],
        supportsSize: true,
        supportsResolution: true,
        supportsWatermark: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req): Promise<VideoGenerationResult> {
      const auth = await resolveApiKeyForProvider({
        provider: "qwen",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("Qwen API key missing");
      }

      const baseUrl = resolveDashscopeAigcApiBaseUrl(
        normalizeBaseUrl(resolveQwenVideoBaseUrl(req), DEFAULT_QWEN_VIDEO_BASE_URL),
      );
      const model = req.model?.trim() || DEFAULT_QWEN_VIDEO_MODEL;
      const headers = new Headers({
        Authorization: `Bearer ${auth.apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      });
      const fetchFn = fetch;
      const submitRes = await fetchFn(
        `${baseUrl}/api/v1/services/aigc/video-generation/video-synthesis`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(buildDashscopeVideoPayload(req, model)),
        },
      );
      await assertOkOrThrowHttpError(submitRes, "Qwen video generation request failed");
      const taskId = coerceTaskId(await submitRes.json());
      if (!taskId) {
        throw new Error("Qwen video generation response missing task id");
      }
      const url = await pollDashscopeVideoTask({
        baseUrl,
        taskId,
        headers,
        timeoutMs: req.timeoutMs ?? DEFAULT_QWEN_VIDEO_TIMEOUT_MS,
        fetchFn,
      });
      return {
        model,
        videos: [
          {
            url,
            mimeType: "video/mp4",
            metadata: { taskId },
          },
        ],
      };
    },
  };
}
