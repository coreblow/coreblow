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

export type FalMusicGenerationProvider = {
  id: "fal";
  label: "fal";
  defaultModel: (typeof FAL_MUSIC_MODELS)[number];
  models: readonly string[];
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

export function buildFalMusicGenerationProvider(): FalMusicGenerationProvider {
  return {
    id: "fal",
    label: "fal",
    defaultModel: FAL_MUSIC_MODELS[0],
    models: [...FAL_MUSIC_MODELS],
    buildRequestBody: buildFalMusicRequestBody,
  };
}
