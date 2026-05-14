/**
 * gateway-sdk/client.ts — Typed client for the CoreBlow Gateway API
 *
 * Provides a typed HTTP client for the OpenAI-compatible
 * /v1/chat/completions endpoint exposed by the CoreBlow gateway.
 */

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatStreamChunk,
  GatewayApiError,
  GatewayClientOptions,
} from "./types.js";

/**
 * HTTP client for the CoreBlow Gateway API.
 *
 * @example
 * ```ts
 * const client = new GatewayClient({ baseUrl: "http://localhost:4141" });
 * const response = await client.chat({
 *   model: "coreblow",
 *   messages: [{ role: "user", content: "Hello!" }],
 * });
 * console.log(response.choices[0].message.content);
 * ```
 */
export class GatewayClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;

  constructor(options: GatewayClientOptions | string) {
    if (typeof options === "string") {
      this.baseUrl = options.replace(/\/+$/, "");
      this.token = undefined;
      this.defaultModel = "coreblow";
      this.timeoutMs = 60_000;
    } else {
      this.baseUrl = options.baseUrl.replace(/\/+$/, "");
      this.token = options.token;
      this.defaultModel = options.defaultModel ?? "coreblow";
      this.timeoutMs = options.timeoutMs ?? 60_000;
    }
  }

  /**
   * Send a chat completion request (non-streaming).
   *
   * @param request - The chat request, or a shorthand with just messages.
   * @returns The parsed chat completion response.
   * @throws {GatewayClientError} on HTTP or parsing errors.
   */
  async chat(request: ChatRequest | { messages: ChatMessage[] }): Promise<ChatResponse> {
    const body: ChatRequest = {
      model: "model" in request && request.model ? request.model : this.defaultModel,
      messages: request.messages,
      stream: false,
      ...("temperature" in request ? { temperature: request.temperature } : {}),
      ...("max_tokens" in request ? { max_tokens: request.max_tokens } : {}),
      ...("user" in request ? { user: request.user } : {}),
    };

    const response = await this.fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new GatewayClientError(
        (errorBody as GatewayApiError | null)?.error?.message ?? `HTTP ${response.status}`,
        response.status,
        errorBody as GatewayApiError | null,
      );
    }

    return (await response.json()) as ChatResponse;
  }

  /**
   * Send a streaming chat completion request.
   * Returns an async iterable of SSE chunks.
   *
   * @param request - The chat request.
   * @yields {ChatStreamChunk} parsed SSE data chunks.
   */
  async *chatStream(
    request: ChatRequest | { messages: ChatMessage[] },
  ): AsyncGenerator<ChatStreamChunk> {
    const body: ChatRequest = {
      model: "model" in request && request.model ? request.model : this.defaultModel,
      messages: request.messages,
      stream: true,
      ...("temperature" in request ? { temperature: request.temperature } : {}),
      ...("max_tokens" in request ? { max_tokens: request.max_tokens } : {}),
      ...("user" in request ? { user: request.user } : {}),
    };

    const response = await this.fetch("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new GatewayClientError(
        (errorBody as GatewayApiError | null)?.error?.message ?? `HTTP ${response.status}`,
        response.status,
        errorBody as GatewayApiError | null,
      );
    }

    if (!response.body) {
      throw new GatewayClientError("Response body is null (streaming not supported)", 0, null);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") return;

          try {
            yield JSON.parse(payload) as ChatStreamChunk;
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /** Build headers with auth and content-type. */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /** Internal fetch wrapper with timeout and headers. */
  private fetch(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    return fetch(url, {
      ...init,
      headers: { ...this.buildHeaders(), ...(init.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }
}

/**
 * Error thrown by GatewayClient on API failures.
 */
export class GatewayClientError extends Error {
  /** HTTP status code (0 if not an HTTP error). */
  readonly status: number;
  /** Parsed error body from the gateway, if available. */
  readonly apiError: GatewayApiError | null;

  constructor(message: string, status: number, apiError: GatewayApiError | null) {
    super(message);
    this.name = "GatewayClientError";
    this.status = status;
    this.apiError = apiError;
  }
}
