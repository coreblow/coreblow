import {
  containerCheck,
  containerFetchAttachment,
  containerRpcRequest,
  streamContainerEvents,
} from "./client-container.js";
import type { SignalRpcOptions } from "./client.js";
import {
  signalCheck as nativeCheck,
  signalRpcRequest as nativeRpcRequest,
  streamSignalEvents as nativeStreamEvents,
} from "./client.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30_000;

export type SignalSseEvent = { event?: string; data?: string };
export type SignalApiMode = "native" | "container" | "auto";
export type { SignalRpcOptions } from "./client.js";

const modeCache = new Map<string, { mode: "native" | "container"; expiresAt: number }>();
const defaultClients = {
  nativeCheck,
  nativeRpcRequest,
  nativeStreamEvents,
  containerCheck,
  containerRpcRequest,
  containerFetchAttachment,
  streamContainerEvents,
};
let clients = { ...defaultClients };

export async function detectSignalApiMode(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  options: { account?: string; requireContainerReceive?: boolean } = {},
): Promise<"native" | "container"> {
  const native = clients.nativeCheck(baseUrl, timeoutMs).then((result) => {
    if (!result.ok) throw new Error("native unavailable");
    return "native" as const;
  });
  const container = clients.containerCheck(
    baseUrl,
    timeoutMs,
    options.requireContainerReceive ? options.account : undefined,
  ).then((result) => {
    if (!result.ok) throw new Error("container unavailable");
    return "container" as const;
  });
  try {
    return await Promise.any([native, container]);
  } catch {
    throw new Error(`Signal API not reachable at ${baseUrl}`);
  }
}

async function resolveMode(params: {
  baseUrl: string;
  timeoutMs?: number;
  apiMode?: SignalApiMode;
  account?: string;
  requireContainerReceive?: boolean;
}): Promise<"native" | "container"> {
  if (params.apiMode === "native" || params.apiMode === "container") return params.apiMode;
  const cached = modeCache.get(params.baseUrl);
  if (cached && cached.expiresAt > Date.now() && !params.requireContainerReceive) return cached.mode;
  const mode = await detectSignalApiMode(params.baseUrl, params.timeoutMs, {
    account: params.account,
    requireContainerReceive: params.requireContainerReceive,
  });
  modeCache.set(params.baseUrl, { mode, expiresAt: Date.now() + CACHE_TTL_MS });
  return mode;
}

export async function signalRpcRequest<T = unknown>(
  method: string,
  params: Record<string, unknown> | undefined,
  opts: SignalRpcOptions & { accountId?: string; apiMode?: SignalApiMode },
): Promise<T> {
  const mode = await resolveMode({
    baseUrl: opts.baseUrl,
    timeoutMs: opts.timeoutMs,
    apiMode: opts.apiMode,
    account: typeof params?.account === "string" ? params.account : undefined,
  });
  return mode === "container"
    ? clients.containerRpcRequest<T>(method, params, opts)
    : clients.nativeRpcRequest<T>(method, params, opts);
}

export async function signalCheck(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  options: { apiMode?: SignalApiMode } = {},
) {
  try {
    const mode = await resolveMode({ baseUrl, timeoutMs, apiMode: options.apiMode });
    return mode === "container"
      ? clients.containerCheck(baseUrl, timeoutMs)
      : clients.nativeCheck(baseUrl, timeoutMs);
  } catch (error) {
    return { ok: false, status: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function streamSignalEvents(params: {
  baseUrl: string;
  account?: string;
  accountId?: string;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  onEvent: (event: SignalSseEvent) => void;
  logger?: { log?: (message: string) => void; error?: (message: string) => void };
  apiMode?: SignalApiMode;
}): Promise<void> {
  const mode = await resolveMode({
    baseUrl: params.baseUrl,
    account: params.account,
    timeoutMs: params.timeoutMs,
    apiMode: params.apiMode,
    requireContainerReceive: true,
  });
  if (mode === "container") {
    return clients.streamContainerEvents({
      ...params,
      onEvent: (event) => params.onEvent({ event: "receive", data: JSON.stringify(event) }),
    });
  }
  return clients.nativeStreamEvents(params);
}

export async function fetchAttachment(params: {
  baseUrl: string;
  account?: string;
  accountId?: string;
  attachmentId: string;
  sender?: string;
  groupId?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  apiMode?: SignalApiMode;
}): Promise<Buffer | null> {
  const mode = await resolveMode(params);
  if (mode === "container") {
    return clients.containerFetchAttachment(params.attachmentId, params);
  }
  if (!params.sender && !params.groupId) return null;
  const result = await clients.nativeRpcRequest<{ data?: string }>(
    "getAttachment",
    {
      id: params.attachmentId,
      ...(params.account ? { account: params.account } : {}),
      ...(params.groupId ? { groupId: params.groupId } : { recipient: params.sender }),
    },
    params,
  );
  return result.data ? Buffer.from(result.data, "base64") : null;
}

export const testing = {
  clearModeCache: () => modeCache.clear(),
  setClientsForTests(overrides: Partial<typeof defaultClients>) {
    clients = { ...defaultClients, ...overrides };
    modeCache.clear();
  },
  resetClientsForTests() {
    clients = { ...defaultClients };
    modeCache.clear();
  },
};
