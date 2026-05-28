import { randomUUID } from "node:crypto";
import type { CliDeps } from "../../cli/deps.js";
import { loadConfig } from "../../config/config.js";
import {
  resolveAgentMainSessionKey,
  resolveMainSessionKey,
  resolveMainSessionKeyFromConfig,
} from "../../config/sessions.js";
import { runCronIsolatedAgentTurn } from "../../cron/isolated-agent.js";
import type { CronJob } from "../../cron/types.js";
import { requestHeartbeatNow } from "../../infra/heartbeat-wake.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import type { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  normalizeHookDispatchSessionKey,
  type HookAgentDispatchPayload,
  type HooksConfigResolved,
} from "../hooks.js";
import { resolveHookClientIpConfig } from "./hook-client-ip-config.js";
import { createHooksRequestHandler, type HookClientIpConfig } from "./hooks-request-handler.js";

type SubsystemLogger = ReturnType<typeof createSubsystemLogger>;

export { resolveHookClientIpConfig };

function sanitizeHookEventName(name: string): string {
  const trimmed = name.trim() || "unnamed hook";
  return trimmed.replace(/^system\s*:/i, "System (untrusted):");
}

function resolveHookResultSummary(result: {
  status?: string;
  summary?: string;
  error?: string;
  diagnostics?: { summary?: string };
}): string {
  const diagnosticsSummary = result.status !== "ok" ? result.diagnostics?.summary?.trim() : "";
  return (
    diagnosticsSummary ||
    result.summary?.trim() ||
    result.error?.trim() ||
    result.status?.trim() ||
    "completed"
  );
}

function buildHookAnnouncement(params: {
  name: string;
  status?: string;
  summary: string;
}): string {
  const name = sanitizeHookEventName(params.name);
  const status = params.status ?? "ok";
  const prefix = status === "ok" ? `Hook ${name}` : `Hook ${name} (${status})`;
  return `${prefix}: ${params.summary}`.trim();
}

export function createGatewayHooksRequestHandler(params: {
  deps: CliDeps;
  getHooksConfig: () => HooksConfigResolved | null;
  getClientIpConfig: () => HookClientIpConfig;
  bindHost: string;
  port: number;
  logHooks: SubsystemLogger;
}) {
  const { deps, getHooksConfig, getClientIpConfig, bindHost, port, logHooks } = params;

  const dispatchWakeHook = (value: { text: string; mode: "now" | "next-heartbeat" }) => {
    const sessionKey = resolveMainSessionKeyFromConfig();
    enqueueSystemEvent(value.text, { sessionKey });
    if (value.mode === "now") {
      requestHeartbeatNow({ reason: "hook:wake" });
    }
  };

  const dispatchAgentHook = (value: HookAgentDispatchPayload) => {
    const sessionKey = normalizeHookDispatchSessionKey({
      sessionKey: value.sessionKey,
      targetAgentId: value.agentId,
    });
    const mainSessionKey = resolveMainSessionKeyFromConfig();
    const jobId = randomUUID();
    const now = Date.now();
    const job: CronJob = {
      id: jobId,
      agentId: value.agentId,
      name: value.name,
      enabled: true,
      createdAtMs: now,
      updatedAtMs: now,
      schedule: { kind: "at", at: new Date(now).toISOString() },
      sessionTarget: "isolated",
      wakeMode: value.wakeMode,
      payload: {
        kind: "agentTurn",
        message: value.message,
        model: value.model,
        thinking: value.thinking,
        timeoutSeconds: value.timeoutSeconds,
        deliver: value.deliver,
        channel: value.channel,
        to: value.to,
        allowUnsafeExternalContent: value.allowUnsafeExternalContent,
        externalContentSource: value.externalContentSource,
      },
      state: { nextRunAtMs: now },
    };

    const runId = randomUUID();
    void (async () => {
      try {
        const cfg = loadConfig();
        const result = await runCronIsolatedAgentTurn({
          cfg,
          deps,
          job,
          message: value.message,
          sessionKey,
          lane: "cron",
          deliveryContract: "shared",
        });
        const summary = resolveHookResultSummary(result);
        const shouldAnnounce =
          result.delivered !== true &&
          result.deliveryAttempted !== true &&
          (result.status !== "ok" || value.deliver === true);
        const announcementSessionKey = value.agentId
          ? resolveAgentMainSessionKey({ cfg, agentId: value.agentId })
          : resolveMainSessionKey(cfg);
        const logMeta = {
          sourcePath: value.sourcePath,
          name: sanitizeHookEventName(value.name),
          runId,
          jobId,
          sessionKey,
          completedAt: new Date().toISOString(),
          status: result.status,
          model: value.model,
          summary,
          consoleMessage: value.model ? `${summary} model=${value.model}` : summary,
        };
        if (shouldAnnounce) {
          enqueueSystemEvent(
            buildHookAnnouncement({
              name: value.name,
              status: result.status,
              summary,
            }),
            {
              sessionKey: announcementSessionKey,
              forceSenderIsOwnerFalse: true,
              trusted: false,
            },
          );
          if (value.wakeMode === "now") {
            requestHeartbeatNow({ reason: `hook:${jobId}` });
          }
          if (result.status === "ok") {
            logHooks.info("hook agent run announced fallback result", logMeta);
          } else {
            logHooks.warn("hook agent run returned non-ok status", logMeta);
          }
        } else if (result.delivered !== true && result.deliveryAttempted !== true) {
          logHooks.info("hook agent run completed without announcement", logMeta);
        }
      } catch (err) {
        const cfg = loadConfig();
        const announcementSessionKey = value.agentId
          ? resolveAgentMainSessionKey({ cfg, agentId: value.agentId })
          : mainSessionKey;
        const summary = String(err);
        logHooks.warn(`hook agent failed: ${summary}`);
        enqueueSystemEvent(
          buildHookAnnouncement({
            name: value.name,
            status: "error",
            summary,
          }),
          {
            sessionKey: announcementSessionKey,
            forceSenderIsOwnerFalse: true,
            trusted: false,
          },
        );
        if (value.wakeMode === "now") {
          requestHeartbeatNow({ reason: `hook:${jobId}:error` });
        }
      }
    })();

    return runId;
  };

  return createHooksRequestHandler({
    getHooksConfig,
    bindHost,
    port,
    logHooks,
    getClientIpConfig,
    dispatchAgentHook,
    dispatchWakeHook,
  });
}
