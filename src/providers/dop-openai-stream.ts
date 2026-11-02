// ============================================================================
// CoreBlow Unified Data-Oriented Programming (DOP) OpenAI-Compatible Stream Engine
// ============================================================================

export interface ProviderEndpointDescriptor {
  readonly id: string;
  readonly label: string;
  readonly baseUrl: string;
  readonly authHeaderName: string;
  readonly authScheme: string;
  readonly defaultModels: readonly string[];
  readonly supportsStreaming: boolean;
  readonly supportsTools: boolean;
  readonly extraHeaders?: Readonly<Record<string, string>>;
}

export interface ChatMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly content: string | null;
  readonly name?: string;
  readonly tool_call_id?: string;
  readonly tool_calls?: readonly unknown[];
}

export interface ChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly top_p?: number;
  readonly max_tokens?: number;
  readonly stream?: boolean;
  readonly tools?: readonly unknown[];
  readonly tool_choice?: unknown;
}

export interface ToolCallDelta {
  readonly index: number;
  readonly id?: string;
  readonly type?: string;
  readonly function?: {
    readonly name?: string;
    readonly arguments?: string;
  };
}

export interface ChatStreamDelta {
  readonly role?: string;
  readonly content?: string;
  readonly tool_calls?: readonly ToolCallDelta[];
  readonly finish_reason?: string | null;
}

// ----------------------------------------------------------------------------
// Built-in Pure DOP Provider Catalog (17 Providers)
// ----------------------------------------------------------------------------

export const CORE_DOP_PROVIDER_CATALOG: Readonly<Record<string, ProviderEndpointDescriptor>> =
  Object.freeze({
    openai: Object.freeze({
      id: "openai",
      label: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["gpt-4o", "gpt-4o-mini", "o3-mini"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    ollama: Object.freeze({
      id: "ollama",
      label: "Ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["llama3.3", "qwen2.5-coder", "deepseek-r1"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    vllm: Object.freeze({
      id: "vllm",
      label: "vLLM",
      baseUrl: "http://127.0.0.1:8000/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["default"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    sglang: Object.freeze({
      id: "sglang",
      label: "SGLang",
      baseUrl: "http://127.0.0.1:30000/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["default"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    deepseek: Object.freeze({
      id: "deepseek",
      label: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["deepseek-chat", "deepseek-reasoner"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    groq: Object.freeze({
      id: "groq",
      label: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["llama-3.3-70b-versatile", "mixtral-8x7b-32768"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    mistral: Object.freeze({
      id: "mistral",
      label: "Mistral AI",
      baseUrl: "https://api.mistral.ai/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["mistral-large-latest", "codestral-latest"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    xai: Object.freeze({
      id: "xai",
      label: "xAI",
      baseUrl: "https://api.x.ai/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["grok-2", "grok-2-mini"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    together: Object.freeze({
      id: "together",
      label: "Together AI",
      baseUrl: "https://api.together.xyz/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["meta-llama/Llama-3.3-70B-Instruct-Turbo"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    fireworks: Object.freeze({
      id: "fireworks",
      label: "Fireworks AI",
      baseUrl: "https://api.fireworks.ai/inference/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["accounts/fireworks/models/llama-v3p3-70b-instruct"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    cerebras: Object.freeze({
      id: "cerebras",
      label: "Cerebras",
      baseUrl: "https://api.cerebras.ai/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["llama3.3-70b"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    openrouter: Object.freeze({
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["auto"]),
      supportsStreaming: true,
      supportsTools: true,
      extraHeaders: Object.freeze({
        "HTTP-Referer": "https://coreblow.com",
        "X-Title": "CoreBlow",
      }),
    }),
    lmstudio: Object.freeze({
      id: "lmstudio",
      label: "LM Studio",
      baseUrl: "http://127.0.0.1:1234/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["default"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    perplexity: Object.freeze({
      id: "perplexity",
      label: "Perplexity",
      baseUrl: "https://api.perplexity.ai",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["sonar-pro", "sonar"]),
      supportsStreaming: true,
      supportsTools: false,
    }),
    moonshot: Object.freeze({
      id: "moonshot",
      label: "Moonshot AI",
      baseUrl: "https://api.moonshot.cn/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["moonshot-v1-8k", "moonshot-v1-32k"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    qwen: Object.freeze({
      id: "qwen",
      label: "Qwen (DashScope)",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["qwen-plus", "qwen-turbo", "qwen-max"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
    minimax: Object.freeze({
      id: "minimax",
      label: "MiniMax",
      baseUrl: "https://api.minimax.chat/v1",
      authHeaderName: "Authorization",
      authScheme: "Bearer",
      defaultModels: Object.freeze(["MiniMax-Text-01"]),
      supportsStreaming: true,
      supportsTools: true,
    }),
  });

export function resolveDopProviderDescriptor(providerId: string): ProviderEndpointDescriptor | null {
  const normalized = providerId.toLowerCase().trim();
  return CORE_DOP_PROVIDER_CATALOG[normalized] ?? null;
}

export function listBuiltInDopProviders(): readonly ProviderEndpointDescriptor[] {
  return Object.values(CORE_DOP_PROVIDER_CATALOG);
}

export function isBuiltInDopProvider(providerId: string): boolean {
  return resolveDopProviderDescriptor(providerId) !== null;
}

// ----------------------------------------------------------------------------
// Pure DOP Request Builder
// ----------------------------------------------------------------------------

export function buildChatCompletionRequest(
  descriptor: ProviderEndpointDescriptor,
  request: ChatCompletionRequest,
  apiKey?: string,
  customBaseUrl?: string,
): { url: string; init: RequestInit } {
  const base = (customBaseUrl ?? descriptor.baseUrl).replace(/\/+$/, "");
  const url = `${base}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (descriptor.extraHeaders) {
    Object.assign(headers, descriptor.extraHeaders);
  }

  if (apiKey && apiKey.trim().length > 0) {
    const authVal = descriptor.authScheme
      ? `${descriptor.authScheme} ${apiKey.trim()}`.trim()
      : apiKey.trim();
    headers[descriptor.authHeaderName] = authVal;
  }

  const payload = {
    ...request,
    stream: request.stream ?? true,
  };

  const init: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  };

  return { url, init };
}

// ----------------------------------------------------------------------------
// Pure DOP SSE Parsing & Delta Extraction
// ----------------------------------------------------------------------------

export function parseSseLines(
  rawChunk: string,
  carryBuffer: string,
): { events: readonly string[]; remainingBuffer: string } {
  const combined = carryBuffer + rawChunk;
  const lines = combined.split(/\r?\n/);
  // The last element is whatever comes after the final newline (may be empty or incomplete)
  const remainingBuffer = lines.pop() ?? "";

  const events: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      // Empty line or SSE comment (keepalive)
      continue;
    }
    if (trimmed.startsWith("data:")) {
      const data = trimmed.slice(5).trim();
      if (data.length > 0) {
        events.push(data);
      }
    }
  }

  return {
    events: Object.freeze(events),
    remainingBuffer,
  };
}

export function extractStreamDelta(rawJsonEvent: string): Readonly<ChatStreamDelta> | null {
  const trimmed = rawJsonEvent.trim();
  if (trimmed === "[DONE]") {
    return Object.freeze({ finish_reason: "stop" });
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      choices?: Array<{
        delta?: {
          role?: string;
          content?: string;
          tool_calls?: Array<{
            index: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
    };

    const choice = parsed.choices?.[0];
    if (!choice) {
      return null;
    }

    const delta = choice.delta;
    const finish_reason = choice.finish_reason ?? null;

    const result: ChatStreamDelta = {
      ...(delta?.role ? { role: delta.role } : {}),
      ...(typeof delta?.content === "string" ? { content: delta.content } : {}),
      ...(delta?.tool_calls ? { tool_calls: delta.tool_calls } : {}),
      finish_reason,
    };

    return Object.freeze(result);
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Streaming Generator with Native Fetch & Abort Timeout
// ----------------------------------------------------------------------------

export interface StreamCompletionOptions {
  apiKey?: string;
  customBaseUrl?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export async function* streamOpenAiCompatibleCompletion(
  descriptor: ProviderEndpointDescriptor,
  request: ChatCompletionRequest,
  options: StreamCompletionOptions = {},
): AsyncGenerator<Readonly<ChatStreamDelta>, void, unknown> {
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const { url, init } = buildChatCompletionRequest(
    descriptor,
    request,
    options.apiKey,
    options.customBaseUrl,
  );

  let timeoutId: NodeJS.Timeout | undefined;
  const controller = new AbortController();

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(options.signal?.reason));
  }

  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${options.timeoutMs}ms`));
    }, options.timeoutMs);
  }

  try {
    const response = await fetchFn(url, {
      ...init,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `OpenAI-compatible request to ${descriptor.id} (${url}) failed with status ${response.status}: ${errText}`,
      );
    }

    if (!response.body) {
      throw new Error(`OpenAI-compatible request to ${descriptor.id} returned no response body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf8");
    let carryBuffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        const { events, remainingBuffer } = parseSseLines(chunkText, carryBuffer);
        carryBuffer = remainingBuffer;

        for (const event of events) {
          const delta = extractStreamDelta(event);
          if (delta) {
            yield delta;
          }
        }
      }

      // Flush any final remaining buffer
      if (carryBuffer.trim().length > 0) {
        const { events } = parseSseLines("", carryBuffer);
        for (const event of events) {
          const delta = extractStreamDelta(event);
          if (delta) {
            yield delta;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
