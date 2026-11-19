import type {
  SessionsListParams,
  SessionsPatchParams,
  SessionsPatchResult,
} from "../gateway/protocol/index.js";
import type { ResponseUsageMode, SessionInfo, SessionScope, TuiOptions } from "./tui-types.js";

export type ChatSendOptions = {
  sessionKey: string;
  sessionId?: string | null;
  message: string;
  thinking?: string;
  deliver?: boolean;
  timeoutMs?: number;
  runId?: string;
};

export type TuiEvent = {
  event: string;
  payload?: unknown;
  seq?: number;
};

export type TuiSessionList = {
  ts: number;
  path: string;
  count: number;
  totalCount?: number;
  limitApplied?: number;
  hasMore?: boolean;
  defaults?: {
    model?: string | null;
    modelProvider?: string | null;
    contextTokens?: number | null;
    thinkingLevels?: Array<{ id: string; label: string }>;
  };
  sessions: Array<
    Pick<
      SessionInfo,
      | "thinkingLevel"
      | "fastMode"
      | "verboseLevel"
      | "reasoningLevel"
      | "model"
      | "contextTokens"
      | "inputTokens"
      | "outputTokens"
      | "totalTokens"
      | "modelProvider"
      | "displayName"
    > & {
      key: string;
      sessionId?: string;
      updatedAt?: number | null;
      sendPolicy?: string;
      responseUsage?: ResponseUsageMode;
      label?: string;
      provider?: string;
      groupChannel?: string;
      space?: string;
      subject?: string;
      chatType?: string;
      origin?: {
        label?: string;
        provider?: string;
        surface?: string;
      };
      lastChannel?: string;
      lastProvider?: string;
      lastTo?: string;
      lastAccountId?: string;
      derivedTitle?: string;
      lastMessagePreview?: string;
    }
  >;
};

export type TuiAgentsList = {
  defaultId: string;
  mainKey: string;
  scope: SessionScope;
  agents: Array<{
    id: string;
    name?: string;
  }>;
};

export type TuiModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
};

export type TuiBackend = {
  connection: {
    url: string;
    token?: string;
    password?: string;
  };
  onEvent?: (evt: TuiEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;
  start: () => void;
  stop: () => void;
  sendChat: (opts: ChatSendOptions) => Promise<{ runId: string }>;
  abortChat: (opts: { sessionKey: string; runId: string }) => Promise<{ ok: boolean; aborted: boolean }>;
  loadHistory: (opts: { sessionKey: string; limit?: number }) => Promise<unknown>;
  listSessions: (opts?: SessionsListParams) => Promise<TuiSessionList>;
  listAgents: () => Promise<TuiAgentsList>;
  patchSession: (opts: SessionsPatchParams) => Promise<SessionsPatchResult>;
  resetSession: (key: string, reason?: "new" | "reset") => Promise<unknown>;
  getStatus?: () => Promise<unknown>;
  getGatewayStatus: () => Promise<unknown>;
  listModels: () => Promise<TuiModelChoice[]>;
};

export async function isGatewayReachable(rawUrl: string, timeoutMs = 800): Promise<boolean> {
  try {
    const httpUrl = rawUrl.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");
    const urlObj = new URL(httpUrl);
    urlObj.pathname = "/healthz";
    const res = await fetch(urlObj.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function resolveTuiBackend(opts: TuiOptions = {}): Promise<TuiBackend> {
  if (opts.backend) {
    return opts.backend;
  }
  if (opts.local === true) {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    return new EmbeddedTuiBackend();
  }

  try {
    const { GatewayChatClient, resolveGatewayConnection } = await import("./gateway-chat.js");
    const connection = await resolveGatewayConnection({
      url: opts.url,
      token: opts.token,
      password: opts.password,
    });

    const reachable = await isGatewayReachable(connection.url, 800);
    if (!reachable) {
      const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
      return new EmbeddedTuiBackend();
    }

    return new GatewayChatClient(connection);
  } catch {
    const { EmbeddedTuiBackend } = await import("./embedded-backend.js");
    return new EmbeddedTuiBackend();
  }
}
