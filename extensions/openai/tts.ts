export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export const OPENAI_TTS_MODELS = ["gpt-4o-mini-tts", "tts-1", "tts-1-hd"] as const;

export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "fable",
  "juniper",
  "marin",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
] as const;

type OpenAiTtsVoice = (typeof OPENAI_TTS_VOICES)[number];

export function normalizeOpenAITtsBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return DEFAULT_OPENAI_BASE_URL;
  }
  return trimmed.replace(/\/+$/, "");
}

function isCustomOpenAIEndpoint(baseUrl?: string): boolean {
  if (baseUrl != null) {
    return normalizeOpenAITtsBaseUrl(baseUrl) !== DEFAULT_OPENAI_BASE_URL;
  }
  return normalizeOpenAITtsBaseUrl(process.env.OPENAI_TTS_BASE_URL) !== DEFAULT_OPENAI_BASE_URL;
}

export function isValidOpenAIModel(model: string, baseUrl?: string): boolean {
  if (isCustomOpenAIEndpoint(baseUrl)) {
    return true;
  }
  return OPENAI_TTS_MODELS.includes(model as (typeof OPENAI_TTS_MODELS)[number]);
}

export function isValidOpenAIVoice(voice: string, baseUrl?: string): voice is OpenAiTtsVoice {
  if (isCustomOpenAIEndpoint(baseUrl)) {
    return true;
  }
  return OPENAI_TTS_VOICES.includes(voice as OpenAiTtsVoice);
}

export function resolveOpenAITtsInstructions(
  model: string,
  instructions?: string,
  baseUrl?: string,
): string | undefined {
  const next = instructions?.trim();
  if (!next) {
    return undefined;
  }
  if (isCustomOpenAIEndpoint(baseUrl)) {
    return next;
  }
  return model.includes("gpt-4o-mini-tts") ? next : undefined;
}

function sanitizeExtraBody(extraBody?: Record<string, unknown>): Record<string, unknown> {
  if (!extraBody) {
    return {};
  }
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extraBody)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

async function readErrorBody(response: Response, maxBytes = 8192): Promise<string | undefined> {
  if (!response.body) {
    return undefined;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }
      const remaining = maxBytes - size;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      size += chunk.byteLength;
      if (value.byteLength > remaining) {
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return new TextDecoder().decode(Buffer.concat(chunks)).trim() || undefined;
}

async function buildTtsError(response: Response): Promise<Error> {
  const body = await readErrorBody(response);
  let detail = body;
  let metadata = "";
  if (body?.length) {
    try {
      const parsed = JSON.parse(body) as {
        error?: { message?: unknown; type?: unknown; code?: unknown };
      };
      const error = parsed.error;
      if (error && typeof error.message === "string") {
        detail = error.message;
        const parts = [
          typeof error.type === "string" ? `type=${error.type}` : undefined,
          typeof error.code === "string" ? `code=${error.code}` : undefined,
        ].filter((part): part is string => part !== undefined);
        if (parts.length > 0) {
          metadata = ` [${parts.join(", ")}]`;
        }
      }
    } catch {
      // Keep the raw body text for non-JSON upstream errors.
    }
  }
  const requestId = response.headers.get("x-request-id");
  const requestMetadata = requestId ? ` [request_id=${requestId}]` : "";
  return new Error(
    `OpenAI TTS API error (${response.status})${detail ? `: ${detail}` : ""}${metadata}${requestMetadata}`,
  );
}

export async function openaiTTS(params: {
  text: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  voice: string;
  speed?: number;
  instructions?: string;
  extraBody?: Record<string, unknown>;
  responseFormat: "mp3" | "opus" | "pcm";
  timeoutMs: number;
}): Promise<Buffer> {
  const {
    text,
    apiKey,
    baseUrl,
    model,
    voice,
    speed,
    instructions,
    extraBody,
    responseFormat,
    timeoutMs,
  } = params;
  const normalizedBaseUrl = normalizeOpenAITtsBaseUrl(baseUrl);
  const effectiveInstructions = resolveOpenAITtsInstructions(model, instructions, normalizedBaseUrl);

  if (!isValidOpenAIModel(model, baseUrl)) {
    throw new Error(`Invalid model: ${model}`);
  }
  if (!isValidOpenAIVoice(voice, baseUrl)) {
    throw new Error(`Invalid voice: ${voice}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const version = process.env.COREBLOW_VERSION?.trim() || "dev";
    const response = await fetch(`${normalizedBaseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        originator: "coreblow",
        version,
        "User-Agent": `coreblow/${version}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: responseFormat,
        ...(speed != null && { speed }),
        ...(effectiveInstructions != null && { instructions: effectiveInstructions }),
        ...sanitizeExtraBody(extraBody),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await buildTtsError(response);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
