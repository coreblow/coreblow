import fs from "node:fs/promises";
import path from "node:path";
import { resolveFetch } from "coreblow/plugin-sdk/fetch-runtime";
import { detectMime } from "coreblow/plugin-sdk/media-runtime";

export type ContainerRpcOptions = {
  baseUrl: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
};

export type ContainerWebSocketMessage = {
  envelope?: Record<string, unknown>;
  exception?: { message?: string };
};

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTACHMENT_BYTES = 1_048_576;
const STYLE_MARKERS: Record<string, string> = {
  BOLD: "**",
  ITALIC: "*",
  STRIKETHROUGH: "~",
  MONOSPACE: "`",
  SPOILER: "||",
};

function normalizeBaseUrl(value: string): string {
  const raw = value.trim();
  if (!raw) throw new Error("Signal base URL is required");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
  if (!url.protocol.match(/^https?:$/) || url.username || url.password) {
    throw new Error("Signal base URL must be HTTP(S) without credentials");
  }
  return `${url.protocol}//${url.host}${url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "")}`;
}

let fetchResolver = resolveFetch;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const fetchImpl = fetchResolver();
  if (!fetchImpl) throw new Error("fetch is not available");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readCappedBuffer(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("Signal REST attachment exceeded size limit");
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Signal REST attachment exceeded size limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function containerRestRequest<T = unknown>(
  endpoint: string,
  opts: ContainerRpcOptions,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(opts.baseUrl)}${endpoint}`,
    {
      method,
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Signal REST ${response.status}: ${text || response.statusText}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function containerCheck(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  account?: string,
): Promise<{ ok: boolean; status?: number | null; error?: string | null }> {
  try {
    const response = await fetchWithTimeout(
      `${normalizeBaseUrl(baseUrl)}/v1/about`,
      { method: "GET" },
      timeoutMs,
    );
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    if (account?.trim()) {
      const socketResult = await checkContainerSocket(baseUrl, account, timeoutMs);
      if (!socketResult.ok) return socketResult;
    }
    return { ok: true, status: response.status, error: null };
  } catch (error) {
    return { ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function checkContainerSocket(baseUrl: string, account: string, timeoutMs: number) {
  return new Promise<{ ok: boolean; status: number | null; error: string | null }>((resolve) => {
    const socket = new WebSocket(
      `${normalizeBaseUrl(baseUrl).replace(/^http/, "ws")}/v1/receive/${encodeURIComponent(account)}`,
    );
    let settled = false;
    const finish = (result: { ok: boolean; status: number | null; error: string | null }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, status: null, error: "Signal container WebSocket timed out" }),
      timeoutMs,
    );
    socket.addEventListener("open", () => finish({ ok: true, status: 101, error: null }), {
      once: true,
    });
    socket.addEventListener(
      "error",
      () => finish({ ok: false, status: null, error: "Signal container WebSocket failed" }),
      { once: true },
    );
  });
}

export async function containerFetchAttachment(
  attachmentId: string,
  opts: ContainerRpcOptions,
): Promise<Buffer | null> {
  const response = await fetchWithTimeout(
    `${normalizeBaseUrl(opts.baseUrl)}/v1/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "GET" },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  if (!response.ok) return null;
  return readCappedBuffer(response, opts.maxResponseBytes ?? DEFAULT_MAX_ATTACHMENT_BYTES);
}

export async function streamContainerEvents(params: {
  baseUrl: string;
  account?: string;
  abortSignal?: AbortSignal;
  onEvent: (event: ContainerWebSocketMessage) => void;
  logger?: { log?: (message: string) => void; error?: (message: string) => void };
}): Promise<void> {
  const url = `${normalizeBaseUrl(params.baseUrl).replace(/^http/, "ws")}/v1/receive/${encodeURIComponent(params.account ?? "")}`;
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const abort = () => {
      socket.close();
      resolve();
    };
    params.abortSignal?.addEventListener("abort", abort, { once: true });
    socket.addEventListener("open", () => params.logger?.log?.("[signal-ws] connected"));
    socket.addEventListener("message", (event) => {
      try {
        params.onEvent(JSON.parse(String(event.data)) as ContainerWebSocketMessage);
      } catch (error) {
        params.logger?.error?.(`[signal-ws] parse error: ${String(error)}`);
      }
    });
    socket.addEventListener("error", () => params.logger?.error?.("[signal-ws] connection error"));
    socket.addEventListener("close", () => {
      params.abortSignal?.removeEventListener("abort", abort);
      resolve();
    });
    if (params.abortSignal?.aborted) abort();
    // Constructor errors are synchronous, but keep the Promise rejection path explicit.
    if (!socket) reject(new Error("Unable to create Signal WebSocket"));
  });
}

async function encodeAttachments(files: string[]): Promise<string[]> {
  return Promise.all(
    files.map(async (filePath) => {
      const buffer = await fs.readFile(filePath);
      const mime = (await detectMime({ buffer, filePath })) ?? "application/octet-stream";
      return `data:${mime};filename=${path.basename(filePath)};base64,${buffer.toString("base64")}`;
    }),
  );
}

function renderStyledText(
  text: string,
  styles: Array<{ start: number; length: number; style: string }>,
): string {
  const opens = new Map<number, string[]>();
  const closes = new Map<number, string[]>();
  for (const style of styles) {
    const marker = STYLE_MARKERS[style.style];
    if (!marker || style.length <= 0) continue;
    (opens.get(style.start) ?? opens.set(style.start, []).get(style.start)!).push(marker);
    const end = Math.min(text.length, style.start + style.length);
    (closes.get(end) ?? closes.set(end, []).get(end)!).push(marker);
  }
  let output = "";
  for (let index = 0; index <= text.length; index += 1) {
    output += (closes.get(index) ?? []).toReversed().join("");
    output += (opens.get(index) ?? []).join("");
    if (index < text.length) output += text[index]?.replace(/[*~`|]/g, "\\$&") ?? "";
  }
  return output;
}

export async function containerSendMessage(params: {
  baseUrl: string;
  account: string;
  recipients: string[];
  message: string;
  textStyles?: Array<{ start: number; length: number; style: string }>;
  attachments?: string[];
  timeoutMs?: number;
}): Promise<{ timestamp?: number }> {
  const body: Record<string, unknown> = {
    number: params.account,
    recipients: params.recipients,
    message: params.textStyles?.length ? renderStyledText(params.message, params.textStyles) : params.message,
  };
  if (params.textStyles?.length) body.text_mode = "styled";
  if (params.attachments?.length) body.base64_attachments = await encodeAttachments(params.attachments);
  const result = await containerRestRequest<{ timestamp?: string | number }>(
    "/v2/send",
    { baseUrl: params.baseUrl, timeoutMs: params.timeoutMs },
    "POST",
    body,
  );
  const timestamp = result?.timestamp == null ? undefined : Number(result.timestamp);
  if (timestamp !== undefined && !Number.isFinite(timestamp)) {
    throw new Error("Signal REST send returned invalid timestamp");
  }
  return timestamp === undefined ? {} : { timestamp };
}

export async function containerSendTyping(params: {
  baseUrl: string;
  account: string;
  recipient: string;
  stop?: boolean;
  timeoutMs?: number;
}): Promise<boolean> {
  await containerRestRequest(
    `/v1/typing-indicator/${encodeURIComponent(params.account)}`,
    params,
    params.stop ? "DELETE" : "PUT",
    { recipient: params.recipient },
  );
  return true;
}

export async function containerSendReceipt(params: {
  baseUrl: string;
  account: string;
  recipient: string;
  timestamp: number;
  type?: "read" | "viewed";
  timeoutMs?: number;
}): Promise<boolean> {
  await containerRestRequest(
    `/v1/receipts/${encodeURIComponent(params.account)}`,
    params,
    "POST",
    { recipient: params.recipient, timestamp: params.timestamp, receipt_type: params.type ?? "read" },
  );
  return true;
}

type ContainerReactionParams = {
  baseUrl: string;
  account: string;
  recipient: string;
  emoji: string;
  targetAuthor: string;
  targetTimestamp: number;
  groupId?: string;
  timeoutMs?: number;
};

async function mutateContainerReaction(
  params: ContainerReactionParams,
  method: "POST" | "DELETE",
): Promise<{ timestamp?: number }> {
  return (
    (await containerRestRequest(
      `/v1/reactions/${encodeURIComponent(params.account)}`,
      params,
      method,
      {
        recipient: params.recipient,
        reaction: params.emoji,
        target_author: params.targetAuthor,
        timestamp: params.targetTimestamp,
        ...(params.groupId ? { group_id: params.groupId } : {}),
      },
    )) ?? {}
  );
}

export function containerSendReaction(params: ContainerReactionParams) {
  return mutateContainerReaction(params, "POST");
}

export function containerRemoveReaction(params: ContainerReactionParams) {
  return mutateContainerReaction(params, "DELETE");
}

function stripUuid(value: string): string {
  return value.startsWith("uuid:") ? value.slice(5) : value;
}
function groupRecipient(value: string): string {
  return value.startsWith("group.") ? value : `group.${Buffer.from(value).toString("base64")}`;
}

export async function containerRpcRequest<T = unknown>(
  method: string,
  params: Record<string, unknown> | undefined,
  opts: ContainerRpcOptions,
): Promise<T> {
  const input = params ?? {};
  if (method === "send") {
    const recipients = ((input.recipient as string[] | undefined) ?? []).map(stripUuid);
    const usernames = ((input.username as string[] | undefined) ?? []).map(stripUuid);
    const groupId = typeof input.groupId === "string" ? groupRecipient(input.groupId) : undefined;
    const styles = (input["text-style"] as string[] | undefined)?.map((value) => {
      const [start, length, style = ""] = value.split(":");
      return { start: Number(start), length: Number(length), style };
    });
    return (await containerSendMessage({
      baseUrl: opts.baseUrl,
      account: String(input.account ?? ""),
      recipients: recipients.length ? recipients : usernames.length ? usernames : groupId ? [groupId] : [],
      message: String(input.message ?? ""),
      textStyles: styles,
      attachments: input.attachments as string[] | undefined,
      timeoutMs: opts.timeoutMs,
    })) as T;
  }
  if (method === "getAttachment") {
    const buffer = await containerFetchAttachment(String(input.id ?? ""), opts);
    return { data: buffer?.toString("base64") } as T;
  }
  if (method === "version") return containerRestRequest<T>("/v1/about", opts);

  if (method === "sendTyping") {
    await containerSendTyping({
      baseUrl: opts.baseUrl,
      account: String(input.account ?? ""),
      recipient: String((input.recipient as string[] | undefined)?.[0] ?? ""),
      stop: input.stop === true,
      timeoutMs: opts.timeoutMs,
    });
    return undefined as T;
  }
  if (method === "sendReceipt") {
    await containerSendReceipt({
      baseUrl: opts.baseUrl,
      account: String(input.account ?? ""),
      recipient: String((input.recipient as string[] | undefined)?.[0] ?? ""),
      timestamp: Number(input.targetTimestamp),
      type: input.type as "read" | "viewed" | undefined,
      timeoutMs: opts.timeoutMs,
    });
    return undefined as T;
  }
  if (method === "sendReaction") {
    const mutation = input.remove ? containerRemoveReaction : containerSendReaction;
    return (await mutation({
      baseUrl: opts.baseUrl,
      account: String(input.account ?? ""),
      recipient: String((input.recipients as string[] | undefined)?.[0] ?? ""),
      emoji: String(input.emoji ?? ""),
      targetAuthor: String(input.targetAuthor ?? ""),
      targetTimestamp: Number(input.targetTimestamp),
      timeoutMs: opts.timeoutMs,
    })) as T;
  }
  throw new Error(`Unsupported container RPC method: ${method}`);
}

export const testing = {
  setFetchForTests(fetchImpl: typeof fetch) {
    fetchResolver = () => fetchImpl;
  },
  resetFetchForTests() {
    fetchResolver = resolveFetch;
  },
};
