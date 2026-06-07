import type {
  AudioTranscriptionRequest,
  AudioTranscriptionResult,
  MediaUnderstandingProvider,
} from "coreblow/plugin-sdk/media-understanding";
import {
  assertOkOrThrowHttpError,
  postTranscriptionRequest,
  requireTranscriptionText,
} from "coreblow/plugin-sdk/provider-http";
import { normalizeElevenLabsBaseUrl } from "./shared.js";

export const DEFAULT_ELEVENLABS_AUDIO_MODEL = "scribe_v2";

type ElevenLabsTranscriptionResponse = {
  text?: unknown;
};

function appendOptionalString(form: FormData, key: string, value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    form.set(key, trimmed);
  }
}

export async function transcribeElevenLabsAudio(
  params: AudioTranscriptionRequest,
): Promise<AudioTranscriptionResult> {
  const fetchFn = params.fetchFn ?? fetch;
  const baseUrl = normalizeElevenLabsBaseUrl(params.baseUrl);
  const model = params.model?.trim() || DEFAULT_ELEVENLABS_AUDIO_MODEL;
  const headers = new Headers(params.headers);
  headers.set("xi-api-key", params.apiKey);

  const form = new FormData();
  form.set(
    "file",
    new Blob([new Uint8Array(params.buffer)], {
      type: params.mime ?? "application/octet-stream",
    }),
    params.fileName || "audio",
  );
  form.set("model_id", model);
  appendOptionalString(form, "language_code", params.language);
  appendOptionalString(form, "prompt", params.prompt);

  const { response, release } = await postTranscriptionRequest({
    url: `${baseUrl}/v1/speech-to-text`,
    headers,
    body: form,
    timeoutMs: params.timeoutMs,
    fetchFn,
    allowPrivateNetwork: Boolean(params.baseUrl?.trim()),
  });

  try {
    await assertOkOrThrowHttpError(response, "Audio transcription failed");
    const payload = (await response.json()) as ElevenLabsTranscriptionResponse;
    const text = typeof payload.text === "string" ? payload.text : undefined;
    return {
      text: requireTranscriptionText(text, "Audio transcription response missing text"),
      model,
    };
  } finally {
    await release();
  }
}

export const elevenLabsMediaUnderstandingProvider: MediaUnderstandingProvider = {
  id: "elevenlabs",
  capabilities: ["audio"],
  defaultModels: { audio: DEFAULT_ELEVENLABS_AUDIO_MODEL },
  autoPriority: { audio: 45 },
  transcribeAudio: transcribeElevenLabsAudio,
};
