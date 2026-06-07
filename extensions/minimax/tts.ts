import { assertOkOrThrowHttpError, postJsonRequest } from "coreblow/plugin-sdk/provider-http";

export const DEFAULT_MINIMAX_TTS_BASE_URL = "https://api.minimax.io";
export const MINIMAX_TTS_MODELS = [
  "speech-2.8-hd",
  "speech-2.8-turbo",
  "speech-2.6-hd",
  "speech-2.6-turbo",
] as const;
export const MINIMAX_TTS_VOICES = [
  "English_expressive_narrator",
  "Chinese (Mandarin)_Warm_Girl",
] as const;

export function normalizeMinimaxTtsBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  return (trimmed || DEFAULT_MINIMAX_TTS_BASE_URL).replace(/\/+$/, "").replace(/\/(?:anthropic|v1)$/i, "");
}

export async function minimaxTTS(params: {
  text: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  voiceId: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  format?: string;
  sampleRate?: number;
  timeoutMs: number;
}): Promise<Buffer> {
  const { response, release } = await postJsonRequest({
    url: `${normalizeMinimaxTtsBaseUrl(params.baseUrl)}/v1/t2a_v2`,
    headers: new Headers({
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    }),
    body: {
      model: params.model,
      text: params.text,
      voice_setting: {
        voice_id: params.voiceId,
        speed: params.speed ?? 1,
        vol: params.vol ?? 1,
        pitch: Math.trunc(params.pitch ?? 0),
      },
      audio_setting: {
        format: params.format ?? "mp3",
        sample_rate: params.sampleRate ?? 32000,
      },
    },
    timeoutMs: params.timeoutMs,
    fetchFn: fetch,
  });
  try {
    await assertOkOrThrowHttpError(response, "MiniMax TTS API error");
    const body = (await response.json()) as { data?: { audio?: string } };
    if (!body.data?.audio) {
      throw new Error("MiniMax TTS API returned no audio data");
    }
    return Buffer.from(body.data.audio, "hex");
  } finally {
    await release();
  }
}
