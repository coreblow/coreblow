import type { Server as HttpServer } from "node:http";
import type { WebSocketServer } from "ws";
import type { CanvasHostHandler, CanvasHostServer } from "../canvas-host/server.js";
import { type ChannelId, listChannelPlugins } from "../channels/plugins/index.js";
import { stopGmailWatcher } from "../hooks/gmail-watcher.js";
import { createInternalHookEvent, triggerInternalHook } from "../hooks/internal-hooks.js";
import type { HeartbeatRunner } from "../infra/heartbeat-runner.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import type { PluginServicesHandle } from "../plugins/services.js";

export type ShutdownResult = {
  durationMs: number;
  warnings: string[];
};

const shutdownLog = createSubsystemLogger("gateway/shutdown");
const GATEWAY_SHUTDOWN_HOOK_TIMEOUT_MS = 5_000;
const GATEWAY_PRE_RESTART_HOOK_TIMEOUT_MS = 10_000;
const WEBSOCKET_CLOSE_GRACE_MS = 1_000;
const WEBSOCKET_CLOSE_FORCE_CONTINUE_MS = 250;
const HTTP_CLOSE_GRACE_MS = 1_000;
const HTTP_CLOSE_FORCE_WAIT_MS = 5_000;

function createTimeoutRace<T>(timeoutMs: number, onTimeout: () => T) {
  let resolve!: (value: T) => void;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  timer = setTimeout(() => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    resolve(onTimeout());
  }, timeoutMs);
  timer.unref?.();

  return {
    promise,
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

function recordShutdownWarning(warnings: string[], name: string): void {
  if (!warnings.includes(name)) {
    warnings.push(name);
  }
}

async function shutdownStep(
  name: string,
  fn: () => Promise<void> | void,
  warnings: string[],
): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    shutdownLog.warn(`${name}: ${detail}`);
    recordShutdownWarning(warnings, name);
    return false;
  }
}

async function triggerGatewayLifecycleHookWithTimeout(params: {
  event: ReturnType<typeof createInternalHookEvent>;
  hookName: "gateway:shutdown" | "gateway:pre-restart";
  timeoutMs: number;
}): Promise<"completed" | "timeout"> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const hookPromise = triggerInternalHook(params.event);
  void hookPromise.catch(() => undefined);
  try {
    const result = await Promise.race([
      hookPromise.then(() => "completed" as const),
      new Promise<"timeout">((resolve) => {
        timeout = setTimeout(() => resolve("timeout"), params.timeoutMs);
        timeout.unref?.();
      }),
    ]);
    if (result === "timeout") {
      shutdownLog.warn(
        `${params.hookName} hook timed out after ${params.timeoutMs}ms; continuing shutdown`,
      );
    }
    return result;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function isServerNotRunningError(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: unknown }).code === "ERR_SERVER_NOT_RUNNING",
  );
}

export function createGatewayCloseHandler(params: {
  bonjourStop: (() => Promise<void>) | null;
  tailscaleCleanup: (() => Promise<void>) | null;
  canvasHost: CanvasHostHandler | null;
  canvasHostServer: CanvasHostServer | null;
  releasePluginRouteRegistry?: (() => void) | null;
  stopChannel: (name: ChannelId, accountId?: string) => Promise<void>;
  pluginServices: PluginServicesHandle | null;
  cron: { stop: () => void };
  heartbeatRunner: HeartbeatRunner;
  updateCheckStop?: (() => void) | null;
  nodePresenceTimers: Map<string, ReturnType<typeof setInterval>>;
  broadcast: (event: string, payload: unknown, opts?: { dropIfSlow?: boolean }) => void;
  tickInterval: ReturnType<typeof setInterval>;
  healthInterval: ReturnType<typeof setInterval>;
  dedupeCleanup: ReturnType<typeof setInterval>;
  mediaCleanup: ReturnType<typeof setInterval> | null;
  agentUnsub: (() => void) | null;
  heartbeatUnsub: (() => void) | null;
  transcriptUnsub: (() => void) | null;
  lifecycleUnsub: (() => void) | null;
  chatRunState: { clear: () => void };
  clients: Set<{ socket: { close: (code: number, reason: string) => void } }>;
  configReloader: { stop: () => Promise<void> };
  wss: WebSocketServer;
  httpServer: HttpServer;
  httpServers?: HttpServer[];
}) {
  return async (opts?: {
    reason?: string;
    restartExpectedMs?: number | null;
  }): Promise<ShutdownResult> => {
    const startedAt = Date.now();
    const warnings: string[] = [];
    try {
      const reasonRaw = typeof opts?.reason === "string" ? opts.reason.trim() : "";
      const reason = reasonRaw || "gateway stopping";
      const restartExpectedMs =
        typeof opts?.restartExpectedMs === "number" && Number.isFinite(opts.restartExpectedMs)
          ? Math.max(0, Math.floor(opts.restartExpectedMs))
          : null;
      shutdownLog.info(`shutdown started: ${reason}`);
      await shutdownStep(
        "gateway:shutdown",
        async () => {
          const shutdownEvent = createInternalHookEvent("gateway", "shutdown", "gateway:shutdown", {
            reason,
            restartExpectedMs,
          });
          const result = await triggerGatewayLifecycleHookWithTimeout({
            event: shutdownEvent,
            hookName: "gateway:shutdown",
            timeoutMs: GATEWAY_SHUTDOWN_HOOK_TIMEOUT_MS,
          });
          if (result === "timeout") {
            recordShutdownWarning(warnings, "gateway:shutdown");
          }
        },
        warnings,
      );
      if (restartExpectedMs !== null) {
        await shutdownStep(
          "gateway:pre-restart",
          async () => {
            const preRestartEvent = createInternalHookEvent(
              "gateway",
              "pre-restart",
              "gateway:pre-restart",
              {
                reason,
                restartExpectedMs,
              },
            );
            const result = await triggerGatewayLifecycleHookWithTimeout({
              event: preRestartEvent,
              hookName: "gateway:pre-restart",
              timeoutMs: GATEWAY_PRE_RESTART_HOOK_TIMEOUT_MS,
            });
            if (result === "timeout") {
              recordShutdownWarning(warnings, "gateway:pre-restart");
            }
          },
          warnings,
        );
      }
      if (params.bonjourStop) {
        await shutdownStep("bonjour", () => params.bonjourStop!(), warnings);
      }
      if (params.tailscaleCleanup) {
        await shutdownStep("tailscale", () => params.tailscaleCleanup!(), warnings);
      }
      if (params.canvasHost) {
        await shutdownStep("canvas-host", () => params.canvasHost!.close(), warnings);
      }
      if (params.canvasHostServer) {
        await shutdownStep("canvas-host-server", () => params.canvasHostServer!.close(), warnings);
      }
      for (const plugin of listChannelPlugins()) {
        await shutdownStep(`channel/${plugin.id}`, () => params.stopChannel(plugin.id), warnings);
      }
      if (params.pluginServices) {
        await shutdownStep("plugin-services", () => params.pluginServices!.stop(), warnings);
      }
      await shutdownStep("gmail-watcher", () => stopGmailWatcher(), warnings);
      params.cron.stop();
      params.heartbeatRunner.stop();
      await shutdownStep("update-check", () => params.updateCheckStop?.(), warnings);
      for (const timer of params.nodePresenceTimers.values()) {
        clearInterval(timer);
      }
      params.nodePresenceTimers.clear();
      params.broadcast("shutdown", {
        reason,
        restartExpectedMs,
      });
      clearInterval(params.tickInterval);
      clearInterval(params.healthInterval);
      clearInterval(params.dedupeCleanup);
      if (params.mediaCleanup) {
        clearInterval(params.mediaCleanup);
      }
      if (params.agentUnsub) {
        await shutdownStep("agent-unsub", () => params.agentUnsub!(), warnings);
      }
      if (params.heartbeatUnsub) {
        await shutdownStep("heartbeat-unsub", () => params.heartbeatUnsub!(), warnings);
      }
      if (params.transcriptUnsub) {
        await shutdownStep("transcript-unsub", () => params.transcriptUnsub!(), warnings);
      }
      if (params.lifecycleUnsub) {
        await shutdownStep("lifecycle-unsub", () => params.lifecycleUnsub!(), warnings);
      }
      params.chatRunState.clear();
      let clientCloseFailures = 0;
      for (const c of params.clients) {
        try {
          c.socket.close(1012, "service restart");
        } catch {
          clientCloseFailures += 1;
        }
      }
      if (clientCloseFailures > 0) {
        shutdownLog.warn(`failed to close ${clientCloseFailures} WebSocket client(s)`);
        recordShutdownWarning(warnings, "ws-clients");
      }
      params.clients.clear();
      await shutdownStep("config-reloader", () => params.configReloader.stop(), warnings);
      const wsClients = params.wss.clients ?? new Set();
      const websocketClosePromise = new Promise<void>((resolve) =>
        params.wss.close(() => resolve()),
      );
      const websocketGraceTimeout = createTimeoutRace(
        WEBSOCKET_CLOSE_GRACE_MS,
        () => false as const,
      );
      const websocketClosedWithinGrace = await Promise.race([
        websocketClosePromise.then(() => true),
        websocketGraceTimeout.promise,
      ]);
      websocketGraceTimeout.clear();
      if (!websocketClosedWithinGrace) {
        shutdownLog.warn(
          `websocket server close exceeded ${WEBSOCKET_CLOSE_GRACE_MS}ms; forcing shutdown continuation with ${wsClients.size} tracked client(s)`,
        );
        recordShutdownWarning(warnings, "websocket-server");
        for (const client of wsClients) {
          try {
            client.terminate();
          } catch {
            /* ignore */
          }
        }
        const websocketForceTimeout = createTimeoutRace(
          WEBSOCKET_CLOSE_FORCE_CONTINUE_MS,
          () => {
            shutdownLog.warn(
              `websocket server close still pending after ${WEBSOCKET_CLOSE_FORCE_CONTINUE_MS}ms force window; continuing shutdown`,
            );
          },
        );
        await Promise.race([websocketClosePromise, websocketForceTimeout.promise]);
        websocketForceTimeout.clear();
      }
      const servers =
        params.httpServers && params.httpServers.length > 0
          ? params.httpServers
          : [params.httpServer];
      for (let i = 0; i < servers.length; i += 1) {
        const server = servers[i];
        const httpServer = server as HttpServer & {
          closeAllConnections?: () => void;
          closeIdleConnections?: () => void;
        };
        const label = servers.length > 1 ? `http-server[${i}]` : "http-server";
        if (typeof httpServer.closeIdleConnections === "function") {
          httpServer.closeIdleConnections();
        }
        const closePromise = new Promise<{ ok: true } | { ok: false }>((resolve) =>
          httpServer.close((err) => {
            if (!err || isServerNotRunningError(err)) {
              resolve({ ok: true });
              return;
            }
            resolve({ ok: false });
          }),
        );
        const httpGraceTimeout = createTimeoutRace(HTTP_CLOSE_GRACE_MS, () => false as const);
        const closedWithinGrace = await Promise.race([
          closePromise.then((result) => {
            if (!result.ok) {
              shutdownLog.warn(`${label}: close failed`);
              recordShutdownWarning(warnings, label);
            }
            return true;
          }),
          httpGraceTimeout.promise,
        ]);
        httpGraceTimeout.clear();
        if (!closedWithinGrace) {
          shutdownLog.warn(
            `${label} close exceeded ${HTTP_CLOSE_GRACE_MS}ms; forcing connection shutdown and waiting for close`,
          );
          recordShutdownWarning(warnings, label);
          httpServer.closeAllConnections?.();
          const httpForceTimeout = createTimeoutRace(HTTP_CLOSE_FORCE_WAIT_MS, () => false as const);
          const closedAfterForce = await Promise.race([
            closePromise.then((result) => {
              if (!result.ok) {
                shutdownLog.warn(`${label}: close failed`);
                recordShutdownWarning(warnings, label);
              }
              return true;
            }),
            httpForceTimeout.promise,
          ]);
          httpForceTimeout.clear();
          if (!closedAfterForce) {
            throw new Error(
              `${label} close still pending after forced connection shutdown (${HTTP_CLOSE_FORCE_WAIT_MS}ms)`,
            );
          }
        }
      }
    } finally {
      try {
        params.releasePluginRouteRegistry?.();
      } catch {
        /* ignore */
      }
    }
    const durationMs = Date.now() - startedAt;
    if (warnings.length > 0) {
      shutdownLog.warn(
        `shutdown completed in ${durationMs}ms with warnings: ${warnings.join(", ")}`,
      );
    } else {
      shutdownLog.info(`shutdown completed cleanly in ${durationMs}ms`);
    }
    return {
      durationMs,
      warnings,
    };
  };
}
