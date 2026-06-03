import { assertOkOrThrowHttpError } from "coreblow/plugin-sdk/provider-http";
import { fetchWithSsrFGuard } from "coreblow/plugin-sdk/ssrf-runtime";
import { normalizeGradiumBaseUrl } from "./shared.js";

export async function gradiumTTS(params: {
  text: string;
  apiKey: string;
  baseUrl: string;
  voiceId: string;
  outputFormat: "wav" | "opus" | "ulaw_8000" | "pcm" | "pcm_24000" | "alaw_8000";
  timeoutMs: number;
}): Promise<Buffer> {
  const normalizedBaseUrl = normalizeGradiumBaseUrl(params.baseUrl);
  const url = `${normalizedBaseUrl}/api/post/speech/tts`;
  const hostname = new URL(normalizedBaseUrl).hostname;
  const { response, release } = await fetchWithSsrFGuard({
    url,
    init: {
      method: "POST",
      headers: {
        "x-api-key": params.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: params.text,
        voice_id: params.voiceId,
        only_audio: true,
        output_format: params.outputFormat,
        json_config: JSON.stringify({ padding_bonus: 0 }),
      }),
    },
    timeoutMs: params.timeoutMs,
    policy: { hostnameAllowlist: [hostname] },
  });

  try {
    await assertOkOrThrowHttpError(response, "Gradium API error");
    return Buffer.from(await response.arrayBuffer());
  } finally {
    await release();
  }
}
