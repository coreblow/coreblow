import crypto from "node:crypto";
import { requestJsonlSocket } from "./jsonl-socket.js";

export type ExecHostRequest = {
  command: string[];
  rawCommand?: string | null;
  cwd?: string | null;
  env?: Record<string, string> | null;
  timeoutMs?: number | null;
  needsScreenRecording?: boolean | null;
  agentId?: string | null;
  sessionKey?: string | null;
  approvalDecision?: "allow-once" | "allow-always" | null;
};

export type ExecHostRunResult = {
  exitCode?: number;
  timedOut: boolean;
  success: boolean;
  stdout: string;
  stderr: string;
  error?: string | null;
};

export type ExecHostError = {
  code: string;
  message: string;
  reason?: string;
};

export type ExecHostResponse =
  | { ok: true; payload: ExecHostRunResult }
  | { ok: false; error: ExecHostError };

export async function requestExecHostViaSocket(params: {
  socketPath: string;
  token: string;
  request: ExecHostRequest;
  timeoutMs?: number;
}): Promise<ExecHostResponse | null> {
  const { socketPath, token, request } = params;
  if (!socketPath || !token) {
    return null;
  }
  const timeoutMs = params.timeoutMs ?? 20_000;
  const requestJson = JSON.stringify(request);
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now();
  const hmac = crypto
    .createHmac("sha256", token)
    .update(`${nonce}:${ts}:${requestJson}`)
    .digest("hex");
  const payload = JSON.stringify({
    type: "exec",
    id: crypto.randomUUID(),
    nonce,
    ts,
    hmac,
    requestJson,
  });

  return await requestJsonlSocket({
    socketPath,
    payload,
    timeoutMs,
    accept: (value) => {
      const msg = value as { type?: string; ok?: boolean; payload?: unknown; error?: unknown };
      if (msg?.type !== "exec-res") {
        return undefined;
      }
      if (msg.ok === true && msg.payload) {
        return { ok: true, payload: msg.payload as ExecHostRunResult };
      }
      if (msg.ok === false && msg.error) {
        return { ok: false, error: msg.error as ExecHostError };
      }
      return null;
    },
  });
}

// ---------------------------------------------------------------------------
// ExecHostService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class ExecHostService {
  async requestExecHostViaSocket(params: Parameters<typeof requestExecHostViaSocket>[0]) {
    return requestExecHostViaSocket(params);
  }
}

let _execHostInstance: ExecHostService | null = null;

export function getExecHostService(): ExecHostService {
  if (!_execHostInstance) {
    _execHostInstance = new ExecHostService();
  }
  return _execHostInstance;
}

export const __testing_execHost = createTestingHooks<ExecHostService>(
  () => { _execHostInstance = null; },
  (svc) => { _execHostInstance = svc; },
);
