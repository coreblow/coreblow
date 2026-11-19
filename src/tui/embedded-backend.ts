import { randomUUID } from "node:crypto";
import { agentCommandFromIngress } from "../agents/agent-command.js";
import { DEFAULT_PROVIDER } from "../agents/defaults.js";
import { onAgentEvent, type AgentEventPayload } from "../infra/agent-events.js";
import { setEmbeddedMode } from "../infra/embedded-mode.js";
import { defaultRuntime } from "../runtime.js";
import type {
  ChatSendOptions,
  TuiAgentsList,
  TuiBackend,
  TuiEvent,
  TuiModelChoice,
  TuiSessionList,
} from "./tui-backend.js";

type LocalRunState = {
  sessionKey: string;
  controller: AbortController;
  buffer: string;
  isBtw: boolean;
  question?: string;
  finalSent: boolean;
};

const silentRuntime = {
  log: (..._args: unknown[]) => undefined,
  error: (..._args: unknown[]) => undefined,
  exit: (code: number): never => {
    throw new Error(`embedded tui runtime exit ${String(code)}`);
  },
};

function resolveBtwQuestion(message: string): string | undefined {
  const match = /^\/(?:btw|side)(?::|\s)+(.*)$/i.exec(message.trim());
  const question = match?.[1]?.trim();
  return question ? question : undefined;
}

function payloadText(parts: unknown): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") {
        return "";
      }
      const payload = part as { text?: unknown };
      return typeof payload.text === "string" ? payload.text.trim() : "";
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function timeoutSecondsFromMs(timeoutMs?: number): string | undefined {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return undefined;
  }
  return String(Math.max(0, Math.ceil(timeoutMs / 1000)));
}

function buildAssistantMessage(text: string) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    timestamp: Date.now(),
  };
}

function resolveDeltaPayload(text: string, previousText: string | undefined) {
  if (previousText === undefined) {
    return { deltaText: text };
  }
  if (!text.startsWith(previousText)) {
    return { deltaText: text, replace: true as const };
  }
  return { deltaText: text.slice(previousText.length) };
}

export class EmbeddedTuiBackend implements TuiBackend {
  readonly connection = { url: "local embedded" };

  onEvent?: (evt: TuiEvent) => void;
  onConnected?: () => void;
  onDisconnected?: (reason: string) => void;
  onGap?: (info: { expected: number; received: number }) => void;

  private runs = new Map<string, LocalRunState>();
  private unsubscribe?: () => void;
  private previousRuntimeLog?: typeof defaultRuntime.log;
  private previousRuntimeError?: typeof defaultRuntime.error;

  start() {
    if (this.unsubscribe) {
      return;
    }
    setEmbeddedMode(true);
    this.previousRuntimeLog = defaultRuntime.log;
    this.previousRuntimeError = defaultRuntime.error;
    defaultRuntime.log = silentRuntime.log;
    defaultRuntime.error = silentRuntime.error;
    this.unsubscribe = onAgentEvent((evt) => {
      this.handleAgentEvent(evt);
    });
    queueMicrotask(() => {
      this.onConnected?.();
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    for (const run of this.runs.values()) {
      run.controller.abort();
    }
    this.runs.clear();
    defaultRuntime.log = this.previousRuntimeLog ?? defaultRuntime.log;
    defaultRuntime.error = this.previousRuntimeError ?? defaultRuntime.error;
    this.previousRuntimeLog = undefined;
    this.previousRuntimeError = undefined;
    setEmbeddedMode(false);
  }

  async sendChat(opts: ChatSendOptions): Promise<{ runId: string }> {
    const runId = opts.runId ?? randomUUID();
    const question = resolveBtwQuestion(opts.message);
    const controller = new AbortController();
    this.runs.set(runId, {
      sessionKey: opts.sessionKey,
      controller,
      buffer: "",
      isBtw: Boolean(question),
      question,
      finalSent: false,
    });

    void this.runTurn({
      runId,
      sessionKey: opts.sessionKey,
      message: opts.message,
      thinking: opts.thinking,
      deliver: opts.deliver,
      timeoutMs: opts.timeoutMs,
      controller,
    });

    return { runId };
  }

  async abortChat(opts: { sessionKey: string; runId: string }) {
    const run = this.runs.get(opts.runId);
    if (!run || run.sessionKey !== opts.sessionKey) {
      return { ok: true, aborted: false };
    }
    run.controller.abort();
    return { ok: true, aborted: true };
  }

  async loadHistory(opts: { sessionKey: string; limit?: number }) {
    try {
      const { getSqliteSession, isSqliteAvailable } = await import(
        "../sessions/sqlite-session-store.js"
      );
      let session = isSqliteAvailable() ? getSqliteSession(opts.sessionKey) : undefined;
      if (!session) {
        const { getUnifiedSession } = await import("../sessions/unified-session-store.js");
        session = getUnifiedSession(opts.sessionKey);
      }
      if (session && Array.isArray(session.messages)) {
        const messages = session.messages.map((m) => ({
          role: m.role,
          content: [{ type: "text", text: m.content }],
          timestamp: m.createdAt || Date.now(),
        }));
        return { messages: messages.slice(-(opts.limit ?? 200)) };
      }
    } catch {
      // Best-effort load from local session store
    }
    return { messages: [] };
  }

  async listSessions(opts?: { limit?: number }): Promise<TuiSessionList> {
    try {
      const { listSqliteSessions, isSqliteAvailable } = await import(
        "../sessions/sqlite-session-store.js"
      );
      let sessions = isSqliteAvailable()
        ? listSqliteSessions({ limit: opts?.limit ?? 50 })
        : [];
      if (sessions.length === 0) {
        const { listUnifiedSessions } = await import("../sessions/unified-session-store.js");
        sessions = listUnifiedSessions({ limit: opts?.limit ?? 50 });
      }
      return {
        ts: Date.now(),
        path: "local embedded",
        count: sessions.length,
        sessions: sessions.map((s) => ({
          key: s.id,
          sessionId: s.id,
          updatedAt: s.updatedAt || s.createdAt,
          model: s.model,
          derivedTitle: s.title,
          lastMessagePreview:
            s.messages && s.messages.length > 0
              ? s.messages[s.messages.length - 1]?.content?.slice(0, 80)
              : undefined,
        })),
      };
    } catch {
      return {
        ts: Date.now(),
        path: "local embedded",
        count: 0,
        sessions: [],
      };
    }
  }

  async listAgents(): Promise<TuiAgentsList> {
    return {
      defaultId: "main",
      mainKey: "main",
      scope: "per-sender",
      agents: [{ id: "main" }],
    };
  }

  async patchSession(opts: { key: string }) {
    return {
      ok: true as const,
      path: "local embedded",
      key: opts.key,
      entry: {
        sessionId: opts.key,
        updatedAt: Date.now(),
      },
    };
  }

  async resetSession(key: string) {
    return { ok: true, key };
  }

  async getStatus(): Promise<unknown> {
    return {
      runtimeVersion: "2.0.0",
      mode: "embedded",
      providerSummary: [
        "Local Embedded CoreBlow ReAct engine",
        `Active workspace: ${process.cwd()}`,
      ],
    };
  }

  async getGatewayStatus(): Promise<unknown> {
    return this.getStatus();
  }

  // ponytail: local model list inferred from config; upgrade when dynamic model probing needed.
  async listModels(): Promise<TuiModelChoice[]> {
    try {
      const { loadConfig } = await import("../config/config.js");
      const cfg = loadConfig();
      const result: TuiModelChoice[] = [];
      const providers = cfg.models?.providers ?? {};
      for (const [providerId, providerCfg] of Object.entries(providers)) {
        if (Array.isArray(providerCfg?.models)) {
          for (const m of providerCfg.models) {
            if (m?.id) {
              result.push({
                id: `${providerId}/${m.id}`,
                name: m.name ?? m.id,
                provider: providerId,
                contextWindow: m.contextWindow,
                reasoning: m.reasoning,
              });
            }
          }
        }
      }
      const defaultModels = cfg.agents?.defaults?.models ?? {};
      for (const [modelKey, modelCfg] of Object.entries(defaultModels)) {
        if (!result.some((r) => r.id === modelKey)) {
          const [prov, ...rest] = modelKey.split("/");
          result.push({
            id: modelKey,
            name: (modelCfg as { alias?: string })?.alias ?? rest.join("/") ?? modelKey,
            provider: prov ?? "default",
          });
        }
      }
      if (result.length === 0) {
        result.push({
          id: "coreblow/native",
          name: "CoreBlow Native Agent",
          provider: "coreblow",
        });
      }
      return result;
    } catch {
      return [
        {
          id: "coreblow/native",
          name: "CoreBlow Native Agent",
          provider: "coreblow",
        },
      ];
    }
  }

  private emit(event: string, payload?: unknown) {
    this.onEvent?.({ event, payload });
  }

  private handleAgentEvent(evt: AgentEventPayload) {
    const run = this.runs.get(evt.runId);
    if (!run) {
      return;
    }
    if (run.isBtw) {
      return;
    }

    if (evt.stream === "tool" && run.buffer === "") {
      this.emit("chat", {
        runId: evt.runId,
        sessionKey: run.sessionKey,
        state: "delta",
        deltaText: "",
        message: buildAssistantMessage(""),
      });
    }

    this.emit("agent", {
      runId: evt.runId,
      stream: evt.stream,
      data: evt.data,
    });

    if (evt.stream === "assistant") {
      const text = typeof evt.data.text === "string" ? evt.data.text : "";
      if (!text || text.length <= 2) {
        run.buffer = text || run.buffer;
        return;
      }
      const previous = run.buffer || undefined;
      run.buffer = text;
      this.emit("chat", {
        runId: evt.runId,
        sessionKey: run.sessionKey,
        state: "delta",
        ...resolveDeltaPayload(text, previous),
        message: buildAssistantMessage(text),
      });
      return;
    }

    if (evt.stream === "lifecycle" && evt.data.phase === "end") {
      this.emitFinal(evt.runId, run, {
        stopReason: typeof evt.data.stopReason === "string" ? evt.data.stopReason : undefined,
      });
    }
  }

  private emitFinal(
    runId: string,
    run: LocalRunState,
    opts: { text?: string; stopReason?: string } = {},
  ) {
    if (run.finalSent) {
      return;
    }
    run.finalSent = true;
    const text = opts.text ?? run.buffer;
    const payload: Record<string, unknown> = {
      runId,
      sessionKey: run.sessionKey,
      state: "final",
    };
    if (opts.stopReason) {
      payload.stopReason = opts.stopReason;
    }
    if (text) {
      payload.message = buildAssistantMessage(text);
    }
    this.emit("chat", payload);
    this.runs.delete(runId);
  }

  private async runTurn(params: {
    runId: string;
    sessionKey: string;
    message: string;
    thinking?: string;
    deliver?: boolean;
    timeoutMs?: number;
    controller: AbortController;
  }) {
    const run = this.runs.get(params.runId);
    if (!run) {
      return;
    }
    try {
      const result = await agentCommandFromIngress({
        message: params.message,
        sessionKey: params.sessionKey,
        thinking: params.thinking,
        deliver: params.deliver,
        timeout: timeoutSecondsFromMs(params.timeoutMs),
        runId: params.runId,
        messageChannel: "tui",
        channel: "tui",
        provider: DEFAULT_PROVIDER,
        senderIsOwner: true,
        allowModelOverride: true,
        abortSignal: params.controller.signal,
      });
      const text = payloadText((result as { payloads?: unknown }).payloads);
      if (run.isBtw) {
        this.emit("chat.side_result", {
          kind: "btw",
          runId: params.runId,
          sessionKey: params.sessionKey,
          question: run.question ?? params.message,
          text,
        });
        this.emit("chat", {
          runId: params.runId,
          sessionKey: params.sessionKey,
          state: "final",
        });
        this.runs.delete(params.runId);
        return;
      }
      if (!run.finalSent) {
        this.emitFinal(params.runId, run, { text });
      }
    } catch (error) {
      if (params.controller.signal.aborted) {
        this.emit("chat", {
          runId: params.runId,
          sessionKey: params.sessionKey,
          state: "aborted",
        });
      } else {
        this.emit("chat", {
          runId: params.runId,
          sessionKey: params.sessionKey,
          state: "error",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
      this.runs.delete(params.runId);
    }
  }
}
