import { randomUUID } from "node:crypto";
import { resolveDebugProxyEnvConfig, type DebugProxyEnvConfig } from "./env.js";
import { createCaptureSession, endCaptureSession, recordCaptureEvent } from "./store.sqlite.js";
import type { CaptureEventRecord, CaptureProtocol } from "./types.js";

export type DebugProxyRuntime = {
  config: DebugProxyEnvConfig;
  sessionId: string;
  enabled: boolean;
  recordEvent(event: Omit<CaptureEventRecord, "sessionId" | "sourceScope" | "sourceProcess">): void;
  close(): void;
};

export function createDebugProxyRuntime(
  env: NodeJS.ProcessEnv = process.env,
): DebugProxyRuntime {
  const config = resolveDebugProxyEnvConfig(env);
  if (config.enabled) {
    createCaptureSession({
      id: config.sessionId,
      startedAt: Date.now(),
      mode: "env",
      sourceScope: "coreblow",
      sourceProcess: config.sourceProcess,
      proxyUrl: config.proxyUrl,
      dbPath: config.dbPath,
      blobDir: config.blobDir,
    });
  }
  return {
    config,
    sessionId: config.sessionId,
    enabled: config.enabled,
    recordEvent(event) {
      if (!config.enabled) {
        return;
      }
      recordCaptureEvent({
        ...event,
        sessionId: config.sessionId,
        sourceScope: "coreblow",
        sourceProcess: config.sourceProcess,
      });
    },
    close() {
      if (config.enabled) {
        endCaptureSession(config.sessionId);
      }
    },
  };
}

export function recordDebugProxyRequest(params: {
  runtime: DebugProxyRuntime;
  protocol?: CaptureProtocol;
  method?: string;
  host?: string;
  path?: string;
  status?: number;
  meta?: Record<string, unknown>;
}): void {
  params.runtime.recordEvent({
    ts: Date.now(),
    protocol: params.protocol ?? "http",
    direction: "outbound",
    kind: params.status == null ? "request" : "response",
    flowId: randomUUID(),
    method: params.method,
    host: params.host,
    path: params.path,
    status: params.status,
    metaJson: params.meta ? JSON.stringify(params.meta) : undefined,
  });
}
