import type {
  GeneratedMusicAsset,
  MusicGenerationProvider,
  MusicGenerationRequest,
  MusicGenerationSourceImage,
} from "coreblow/plugin-sdk/music-generation-core";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import { assertOkOrThrowHttpError, postJsonRequest } from "coreblow/plugin-sdk/provider-http";
import { OPENROUTER_BASE_URL } from "./provider-catalog.js";

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
  inputImages?: readonly MusicGenerationSourceImage[];
};

export type OpenRouterMusicGenerationProvider = MusicGenerationProvider & {
  buildRequestBody: (req: OpenRouterMusicGenerationRequest) => Record<string, unknown>;
};

function toImageUrl(image: MusicGenerationSourceImage): string | undefined {
  if (image.url) {
    return image.url;
  }
  if (image.buffer) {
    const mimeType = image.mimeType || "image/png";
    return `data:${mimeType};base64,${image.buffer.toString("base64")}`;
  }
  return undefined;
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

function collectOpenRouterMusicOutputs(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    const dataUrls = value.match(/data:audio\/[^;\s]+;base64,[A-Za-z0-9+/=]+/gu);
    if (dataUrls) {
      out.push(...dataUrls);
    }
    if (/^https?:\/\//u.test(value)) {
      out.push(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectOpenRouterMusicOutputs(entry, out);
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["url", "audio_url", "music_url", "data"]) {
    collectOpenRouterMusicOutputs(record[key], out);
  }
  for (const key of ["audio", "audios", "tracks", "output", "result", "choices", "message", "content"]) {
    collectOpenRouterMusicOutputs(record[key], out);
  }
}

function parseAudioDataUrl(value: string, index: number): GeneratedMusicAsset | undefined {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,(.+)$/u.exec(value.trim());
  if (!match) {
    return undefined;
  }
  const mimeType = match[1] || "audio/mpeg";
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  return {
    buffer: Buffer.from(match[2] ?? "", "base64"),
    mimeType,
    fileName: `track-${index + 1}.${extension}`,
  };
}

async function musicAssetFromOutput(value: string, index: number): Promise<GeneratedMusicAsset> {
  const dataUrlAsset = parseAudioDataUrl(value, index);
  if (dataUrlAsset) {
    return dataUrlAsset;
  }
  const response = await fetch(value);
  await assertOkOrThrowHttpError(response, "OpenRouter generated music download failed");
  const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "audio/mpeg";
  const extension = mimeType.includes("wav") ? "wav" : "mp3";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType,
    fileName: `track-${index + 1}.${extension}`,
    metadata: { url: value },
  };
}

export function buildOpenRouterMusicGenerationProvider(): OpenRouterMusicGenerationProvider {
  return {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: OPENROUTER_MUSIC_MODELS[0],
    models: [...OPENROUTER_MUSIC_MODELS],
    capabilities: {
      maxTracks: 1,
      maxDurationSeconds: 180,
      supportsLyrics: true,
      supportsInstrumental: true,
      supportsDuration: true,
      maxInputImages: 4,
      generate: {
        maxTracks: 1,
        maxDurationSeconds: 180,
        supportsLyrics: true,
        supportsInstrumental: true,
        supportsDuration: true,
      },
      edit: {
        enabled: true,
        maxTracks: 1,
        maxDurationSeconds: 180,
        maxInputImages: 4,
        supportsLyrics: true,
        supportsInstrumental: true,
        supportsDuration: true,
      },
    },
    buildRequestBody: (req) => ({
      model: req.model || OPENROUTER_MUSIC_MODELS[0],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildOpenRouterMusicPrompt(req) },
            ...(req.inputImages ?? []).flatMap((image) => {
              const url = toImageUrl(image);
              return url ? [{ type: "image_url", image_url: { url } }] : [];
            }),
          ],
        },
      ],
      modalities: ["audio", "text"],
    }),
    async generateMusic(req: MusicGenerationRequest) {
      const auth = await resolveApiKeyForProvider({
        provider: "openrouter",
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("OpenRouter API key missing");
      }
      const model = req.model?.trim() || OPENROUTER_MUSIC_MODELS[0];
      const { response, release } = await postJsonRequest({
        url: `${OPENROUTER_BASE_URL}/chat/completions`,
        headers: new Headers({
          Authorization: `Bearer ${auth.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://coreblow.com",
          "X-OpenRouter-Title": "CoreBlow",
        }),
        body: this.buildRequestBody({ ...req, model }),
        timeoutMs: req.timeoutMs ?? 180_000,
        fetchFn: fetch,
      });
      try {
        await assertOkOrThrowHttpError(response, "OpenRouter music generation failed");
        const outputs: string[] = [];
        collectOpenRouterMusicOutputs(await response.json(), outputs);
        const uniqueOutputs = [...new Set(outputs)];
        if (uniqueOutputs.length === 0) {
          throw new Error("OpenRouter music generation response missing audio output");
        }
        return {
          model,
          tracks: await Promise.all(uniqueOutputs.map(musicAssetFromOutput)),
        };
      } finally {
        await release();
      }
    },
  };
}
