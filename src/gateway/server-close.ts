import type { Server as HttpServer } from "node:http";
import type { WebSocketServer } from "ws";
import type { CanvasHostHandler, CanvasHostServer } from "../canvas-host/server.js";
import { type ChannelId, listChannelPlugins } from "../channels/plugins/index.js";
import { stopGmailWatcher } from "../hooks/gmail-watcher.js";
import type { HeartbeatRunner } from "../infra/heartbeat-runner.js";
import type { PluginServicesHandle } from "../plugins/services.js";

export type ShutdownResult = {
  durationMs: number;
  warnings: string[];
};

function recordShutdownWarning(warnings: string[], name: string): void {
  if (!warnings.includes(name)) {
    warnings.push(name);
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
      if (params.bonjourStop) {
        try {
          await params.bonjourStop();
        } catch {
          /* ignore */
        }
      }
      if (params.tailscaleCleanup) {
        await params.tailscaleCleanup();
      }
      if (params.canvasHost) {
        try {
          await params.canvasHost.close();
        } catch {
          /* ignore */
        }
      }
      if (params.canvasHostServer) {
        try {
          await params.canvasHostServer.close();
        } catch {
          /* ignore */
        }
      }
      for (const plugin of listChannelPlugins()) {
        await params.stopChannel(plugin.id);
      }
      if (params.pluginServices) {
        await params.pluginServices.stop().catch(() => {});
      }
      await stopGmailWatcher();
      params.cron.stop();
      params.heartbeatRunner.stop();
      try {
        params.updateCheckStop?.();
      } catch {
        /* ignore */
      }
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
        try {
          params.agentUnsub();
        } catch {
          /* ignore */
        }
      }
      if (params.heartbeatUnsub) {
        try {
          params.heartbeatUnsub();
        } catch {
          /* ignore */
        }
      }
      if (params.transcriptUnsub) {
        try {
          params.transcriptUnsub();
        } catch {
          /* ignore */
        }
      }
      if (params.lifecycleUnsub) {
        try {
          params.lifecycleUnsub();
        } catch {
          /* ignore */
        }
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
        recordShutdownWarning(warnings, "ws-clients");
      }
      params.clients.clear();
      await params.configReloader.stop().catch(() => {});
      await new Promise<void>((resolve) => params.wss.close(() => resolve()));
      const servers =
        params.httpServers && params.httpServers.length > 0
          ? params.httpServers
          : [params.httpServer];
      for (let i = 0; i < servers.length; i += 1) {
        const server = servers[i];
        const httpServer = server as HttpServer & {
          closeIdleConnections?: () => void;
        };
        const label = servers.length > 1 ? `http-server[${i}]` : "http-server";
        if (typeof httpServer.closeIdleConnections === "function") {
          httpServer.closeIdleConnections();
        }
        await new Promise<void>((resolve, reject) =>
          httpServer.close((err) => {
            if (!err || isServerNotRunningError(err)) {
              resolve();
              return;
            }
            reject(err);
          }),
        ).catch(() => {
          recordShutdownWarning(warnings, label);
        });
      }
    } finally {
      try {
        params.releasePluginRouteRegistry?.();
      } catch {
        /* ignore */
      }
    }
    return {
      durationMs: Date.now() - startedAt,
      warnings,
    };
  };
}
