/**
 * Agent harness runtime surface for plugin-sdk parity.
 *
 * CoreBlow does not implement the OpenClaw agent harness registry, but exports
 * the underlying OOP behavior and utility functions that power the harness.
 */
export type { CompactEmbeddedPiSessionParams } from "../agents/pi-embedded-runner/compact.js";
export type { EmbeddedPiCompactResult } from "../agents/pi-embedded-runner/types.js";
export type { AnyAgentTool } from "../agents/tools/common.js";
export type { HeartbeatToolResponse } from "../auto-reply/heartbeat-tool-response.js";
export type {  AgentEventPayload } from "../infra/agent-events.js";
export type { ExecApprovalDecision } from "../infra/exec-approvals.js";
export type { NormalizedUsage } from "../agents/usage.js";
export { VERSION as OPENCLAW_VERSION } from "../version.js";
export { formatErrorMessage } from "../infra/errors.js";
export { formatApprovalDisplayPath } from "../infra/approval-display-paths.js";
export { emitAgentEvent, onAgentEvent, resetAgentEventsForTest } from "../infra/agent-events.js";
export { log as embeddedAgentLog } from "../agents/pi-embedded-runner/logger.js";
export { resolveEmbeddedAgentRuntime } from "../agents/pi-embedded-runner/runtime.js";
export { resolveUserPath } from "../utils.js";
export { callGatewayTool } from "../agents/tools/gateway.js";
export type { NodeListNode } from "../agents/tools/nodes-utils.js";
export { formatToolAggregate } from "../auto-reply/tool-meta.js";
export { isMessagingTool, isMessagingToolSendAction } from "../agents/pi-embedded-messaging.js";
export { normalizeUsage } from "../agents/usage.js";
export { resolveModelAuthMode } from "../agents/model-auth.js";
export { supportsModelTools } from "../agents/model-tool-support.js";
export { resolveAttemptSpawnWorkspaceDir } from "../agents/pi-embedded-runner/run/attempt.thread-helpers.js";
export { resolveSandboxContext } from "../agents/sandbox.js";
export { resolveBootstrapContextForRun } from "../agents/bootstrap-files.js";
export type { EmbeddedContextFile } from "../agents/pi-embedded-helpers/types.js";
export { isSubagentSessionKey } from "../routing/session-key.js";
export { emitSessionTranscriptUpdate } from "../sessions/transcript-events.js";

export const TOOL_PROGRESS_OUTPUT_MAX_CHARS = 8_000;

export type ToolProgressDetailMode = "explain" | "raw";

import { resolveToolDisplay, formatToolDetail } from "../agents/tool-display.js";
import { redactToolDetail } from "../logging/redact.js";
import { truncateUtf16Safe } from "../utils.js";

export function inferToolMetaFromArgs(
  toolName: string,
  args: unknown,
  options?: { detailMode?: ToolProgressDetailMode },
): string | undefined {
  const display = resolveToolDisplay({ name: toolName, args });
  return formatToolDetail(display);
}

export function formatToolProgressOutput(
  output: string,
  options?: { maxChars?: number },
): string | undefined {
  const trimmed = output.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!trimmed) {
    return undefined;
  }
  const redacted = redactToolDetail(trimmed);
  const maxChars = options?.maxChars ?? TOOL_PROGRESS_OUTPUT_MAX_CHARS;
  if (redacted.length <= maxChars) {
    return redacted;
  }
  return `${truncateUtf16Safe(redacted, maxChars)}\n...(truncated)...`;
}

export type AgentHarnessTerminalOutcomeInput = {
  assistantTexts: readonly string[];
  reasoningText?: string | null;
  planContent?: string | null;
  promptError?: unknown;
  turnCompleted: boolean;
};

export type AgentHarnessTerminalOutcomeClassification = "planning-only" | "reasoning-only" | "empty";

export function classifyAgentHarnessTerminalOutcome(
  params: AgentHarnessTerminalOutcomeInput,
): AgentHarnessTerminalOutcomeClassification | undefined {
  if (
    !params.turnCompleted ||
    (params.promptError !== undefined && params.promptError !== null) ||
    hasVisibleAssistantText(params.assistantTexts)
  ) {
    return undefined;
  }
  if (params.planContent?.trim()) {
    return "planning-only";
  }
  if (params.reasoningText?.trim()) {
    return "reasoning-only";
  }
  return "empty";
}

function hasVisibleAssistantText(assistantTexts: readonly string[]): boolean {
  return assistantTexts.some((text) => text.trim().length > 0);
}
