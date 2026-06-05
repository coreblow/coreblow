import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, normalizeBaseUrl } from "coreblow/plugin-sdk/provider-http";
import type {
  GeneratedMusicAsset,
  MusicGenerationProvider,
  MusicGenerationRequest,
} from "coreblow/plugin-sdk/music-generation-core";

const DEFAULT_FAL_BASE_URL = "https://fal.run";

export const FAL_MUSIC_MODELS = [
  "fal-ai/minimax-music/v2.6",
  "fal-ai/ace-step/prompt-to-audio",
  "fal-ai/stable-audio-25/text-to-audio",
] as const;

export type FalMusicGenerationRequest = {
  model?: string;
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  durationSeconds?: number;
  format?: "mp3" | "wav";
};

export type FalMusicGenerationProvider = MusicGenerationProvider & {
  buildRequestBody: (req: FalMusicGenerationRequest) => Record<string, unknown>;
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveFalMusicModel(model: string | undefined): string {
  return normalizeOptionalString(model) ?? FAL_MUSIC_MODELS[0];
}

export function buildFalMusicRequestBody(req: FalMusicGenerationRequest): Record<string, unknown> {
  const model = resolveFalMusicModel(req.model);
  const lyrics = normalizeOptionalString(req.lyrics);
  if (model === "fal-ai/ace-step/prompt-to-audio") {
    if (lyrics) {
      throw new Error("fal ACE-Step music generation does not support explicit lyrics.");
    }
    return {
      prompt: req.prompt,
      ...(req.instrumental === true ? { instrumental: true } : {}),
      ...(typeof req.durationSeconds === "number" ? { duration: req.durationSeconds } : {}),
    };
  }
  if (model === "fal-ai/stable-audio-25/text-to-audio") {
    if (lyrics) {
      throw new Error("fal Stable Audio music generation does not support explicit lyrics.");
    }
    if (req.instrumental === true) {
      throw new Error("fal Stable Audio music generation does not support instrumental mode.");
    }
    return {
      prompt: req.prompt,
      ...(typeof req.durationSeconds === "number" ? { seconds_total: req.durationSeconds } : {}),
    };
  }
  if (lyrics && req.instrumental === true) {
    throw new Error("fal MiniMax music generation cannot use lyrics when instrumental=true.");
  }
  return {
    prompt: req.prompt,
    ...(lyrics ? { lyrics } : {}),
    ...(req.instrumental === true ? { is_instrumental: true } : {}),
    ...(!lyrics && req.instrumental !== true ? { lyrics_optimizer: true } : {}),
    ...(typeof req.durationSeconds === "number" ? { duration: req.durationSeconds } : {}),
    audio_setting: {
      sample_rate: 44_100,
      bitrate: 256_000,
      format: req.format ?? "mp3",
    },
  };
}

function collectFalMusicUrls(value: unknown, out: string[]): void {
  if (typeof value === "string" && /^https?:\/\//u.test(value)) {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectFalMusicUrls(entry, out);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["url", "audio_url", "music_url", "song_url"]) {
    collectFalMusicUrls(record[key], out);
  }
  for (const key of ["audio", "audios", "music", "tracks", "data", "output", "result"]) {
    collectFalMusicUrls(record[key], out);
  }
}

async function downloadFalMusicAsset(url: string, index: number): Promise<GeneratedMusicAsset> {
  const response = await fetch(url);
  await assertOkOrThrowHttpError(response, "fal generated music download failed");
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    fileName: `track-${index + 1}.${extension}`,
    metadata: { url },
  };
}

export function buildFalMusicGenerationProvider(): FalMusicGenerationProvider {
  return {
    id: "fal",
    label: "fal",
    defaultModel: FAL_MUSIC_MODELS[0],
    models: [...FAL_MUSIC_MODELS],
    capabilities: {
      maxTracks: 1,
      maxDurationSeconds: 300,
      supportsLyrics: true,
      supportsInstrumental: true,
      supportsDuration: true,
      supportsFormat: true,
      supportedFormats: ["mp3", "wav"],
      generate: {
        maxTracks: 1,
        maxDurationSeconds: 300,
        supportsLyrics: true,
        supportsInstrumental: true,
        supportsDuration: true,
        supportsFormat: true,
        supportedFormats: ["mp3", "wav"],
      },
      edit: {
        enabled: false,
      },
    },
    buildRequestBody: buildFalMusicRequestBody,
    async generateMusic(req: MusicGenerationRequest) {
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
      const model = resolveFalMusicModel(req.model);
      const response = await fetch(`${baseUrl}/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Key ${auth.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildFalMusicRequestBody({ ...req, model })),
      });
      await assertOkOrThrowHttpError(response, "fal music generation failed");
      const urls: string[] = [];
      collectFalMusicUrls(await response.json(), urls);
      const uniqueUrls = [...new Set(urls)];
      if (uniqueUrls.length === 0) {
        throw new Error("fal music generation response missing audio output");
      }
      return {
        model,
        tracks: await Promise.all(uniqueUrls.map(downloadFalMusicAsset)),
      };
    },
  };
}
