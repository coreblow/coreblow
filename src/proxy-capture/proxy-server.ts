import { randomUUID } from "node:crypto";
import { createCaptureSession, endCaptureSession } from "./store.sqlite.js";
import type { CaptureSessionRecord } from "./types.js";

export const COREBLOW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY =
  "COREBLOW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY";

export function isManagedProxyActive(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.COREBLOW_PROXY_ACTIVE;
  return value === "1" || value?.toLowerCase() === "true";
}

export type ManagedDebugProxy = {
  session: CaptureSessionRecord;
  proxyUrl: string;
  close(): Promise<void>;
};

export async function startManagedDebugProxy(params: {
  dbPath: string;
  blobDir: string;
  proxyUrl?: string;
  sessionId?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<ManagedDebugProxy> {
  const sessionId = params.sessionId ?? randomUUID();
  const proxyUrl = params.proxyUrl ?? "http://127.0.0.1:0";
  const session = createCaptureSession({
    id: sessionId,
    startedAt: Date.now(),
    mode: "managed",
    sourceScope: "coreblow",
    sourceProcess: "coreblow",
    proxyUrl,
    dbPath: params.dbPath,
    blobDir: params.blobDir,
  });
  return {
    session,
    proxyUrl,
    async close() {
      endCaptureSession(sessionId);
    },
  };
}
