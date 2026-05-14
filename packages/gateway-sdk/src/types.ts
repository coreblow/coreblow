/**
 * gateway-sdk/types.ts — Public type definitions for the CoreBlow Gateway SDK
 *
 * These types align with the OpenAI-compatible API surface exposed by the
 * CoreBlow gateway at /v1/chat/completions.
 */

// ─── Chat Messages ───────────────────────────────────────────────

/** A text content part in a multi-part message. */
export interface ChatMessageTextPart {
  type: "text";
  text: string;
}

/** An image URL content part in a multi-part message. */
export interface ChatMessageImagePart {
  type: "image_url";
  image_url: { url: string };
}

/** A single content part within a chat message. */
export type ChatMessagePart = ChatMessageTextPart | ChatMessageImagePart;

/** Content can be a plain string or an array of structured parts. */
export type ChatMessageContent = string | ChatMessagePart[];

/** A chat message in the OpenAI-compatible format. */
export interface ChatMessage {
  /** The role of the message author. */
  role: "system" | "developer" | "user" | "assistant" | "tool";
  /** The content of the message. */
  content: ChatMessageContent;
  /** Optional name for the participant (used with tool role). */
  name?: string;
}

// ─── Request ─────────────────────────────────────────────────────

/** Request body for POST /v1/chat/completions. */
export interface ChatRequest {
  /** Model identifier (e.g. "coreblow", "claude-sonnet-4-20250514"). */
  model: string;
  /** The conversation messages. */
  messages: ChatMessage[];
  /** Whether to stream the response via SSE. */
  stream?: boolean;
  /** Optional user identifier for session scoping. */
  user?: string;
  /** Sampling temperature (0-2). */
  temperature?: number;
  /** Maximum tokens to generate. */
  max_tokens?: number;
}

// ─── Response ────────────────────────────────────────────────────

/** Token usage statistics returned with non-streaming responses. */
export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** A single choice in a chat completion response. */
export interface ChatChoice {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: "stop" | "length" | "tool_calls" | null;
}

/** Non-streaming response from POST /v1/chat/completions. */
export interface ChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: ChatUsage;
}

// ─── Streaming ───────────────────────────────────────────────────

/** Delta content in a streaming chunk. */
export interface ChatStreamDelta {
  role?: "assistant";
  content?: string;
}

/** A single choice in a streaming chunk. */
export interface ChatStreamChoice {
  index: number;
  delta: ChatStreamDelta;
  finish_reason: "stop" | null;
}

/** A streaming chunk from POST /v1/chat/completions?stream=true. */
export interface ChatStreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatStreamChoice[];
}

// ─── Client Options ──────────────────────────────────────────────

/** Configuration options for the GatewayClient. */
export interface GatewayClientOptions {
  /** Base URL of the CoreBlow gateway (e.g. "http://localhost:4141"). */
  baseUrl: string;
  /** Authorization token (sent as Bearer token). */
  token?: string;
  /** Default model to use when not specified per-request. */
  defaultModel?: string;
  /** Default request timeout in milliseconds. */
  timeoutMs?: number;
}

// ─── Error ───────────────────────────────────────────────────────

/** Error response from the gateway API. */
export interface GatewayApiError {
  error: {
    message: string;
    type: "invalid_request_error" | "api_error" | "authentication_error";
  };
}
