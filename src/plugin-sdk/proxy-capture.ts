// Re-export proxy-capture debug utilities for plugin use.
// captureHttpExchange is a compatibility shim that records HTTP exchanges
// via CoreBlow's debug proxy runtime when active, or no-ops otherwise.

import { createDebugProxyRuntime } from "../proxy-capture/runtime.js";
import { resolveDebugProxyEnvConfig } from "../proxy-capture/env.js";

export { createDebugProxyRuntime } from "../proxy-capture/runtime.js";
export { resolveDebugProxyEnvConfig } from "../proxy-capture/env.js";
export { resolveDebugProxyDbPath, resolveDebugProxyBlobDir } from "../proxy-capture/paths.js";

type CaptureHttpExchangeParams = {
  url: string;
  method: string;
  requestHeaders?: Headers | Record<string, string> | undefined;
  requestBody?: BodyInit | Buffer | string | null;
  response: Response;
  transport?: "http" | "sse";
  flowId?: string;
  meta?: Record<string, unknown>;
};

export function captureHttpExchange(
  params: CaptureHttpExchangeParams,
): void {
  try {
    const envConfig = resolveDebugProxyEnvConfig();
    if (!envConfig.enabled) {
      return;
    }
    const runtime = createDebugProxyRuntime({
      dbPath: envConfig.dbPath,
      blobDir: envConfig.blobDir,
    });
    let host: string | undefined;
    let path: string | undefined;
    try {
      const parsed = new URL(params.url);
      host = parsed.hostname;
      path = parsed.pathname + parsed.search;
    } catch {
      // If URL parsing fails, store full url as path.
      path = params.url;
    }
    runtime.recordEvent({
      ts: Date.now(),
      protocol: (params.transport === "sse" ? "sse" : "http") as "http" | "sse",
      direction: "outbound",
      kind: "response",
      flowId: params.flowId ?? crypto.randomUUID(),
      method: params.method,
      host,
      path,
      status: params.response.status,
      ...(params.meta ? { metaJson: JSON.stringify(params.meta) } : {}),
    });
  } catch {
    // Debug proxy capture is best-effort; never block main flow.
  }
}
