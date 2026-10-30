import type { ReplyPayload } from "../auto-reply/types.js";
import type {
  InteractiveReply,
  InteractiveReplyButton,
  MessagePresentation,
  MessagePresentationButton,
} from "../interactive/payload.js";
import { resolveExecApprovalAllowedDecisions, type ExecHost } from "./exec-approvals.js";

export type ExecApprovalReplyDecision = "allow-once" | "allow-always" | "deny";
export type ExecApprovalUnavailableReason =
  | "initiating-platform-disabled"
  | "initiating-platform-unsupported"
  | "no-approval-route";

export type ExecApprovalReplyMetadata = {
  approvalId: string;
  approvalSlug: string;
  approvalKind?: "exec" | "plugin";
  agentId?: string;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
  sessionKey?: string;
};

export type ExecApprovalActionDescriptor = {
  decision: ExecApprovalReplyDecision;
  label: string;
  style: NonNullable<MessagePresentationButton["style"]>;
  command: string;
};

export type ExecApprovalPendingReplyParams = {
  warningText?: string;
  approvalId: string;
  approvalSlug: string;
  approvalCommandId?: string;
  ask?: string | null;
  agentId?: string | null;
  command: string;
  cwd?: string;
  host: ExecHost;
  nodeId?: string;
  sessionKey?: string | null;
  expiresAtMs?: number;
  nowMs?: number;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
};

export type ExecApprovalUnavailableReplyParams = {
  warningText?: string;
  channelLabel?: string;
  reason: ExecApprovalUnavailableReason;
  sentApproverDms?: boolean;
};

export function getExecApprovalApproverDmNoticeText(): string {
  return "Approval required. I sent the allowed approvers DMs.";
}

function buildFence(text: string, language?: string): string {
  let fence = "```";
  while (text.includes(fence)) {
    fence += "`";
  }
  const languagePrefix = language ? language : "";
  return `${fence}${languagePrefix}\n${text}\n${fence}`;
}

function resolveAllowedDecisions(params: {
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): readonly ExecApprovalReplyDecision[] {
  return params.allowedDecisions ?? resolveExecApprovalAllowedDecisions({ ask: params.ask });
}

export function buildExecApprovalCommandText(params: {
  approvalCommandId: string;
  decision: ExecApprovalReplyDecision;
}): string {
  return `/approve ${params.approvalCommandId} ${params.decision}`;
}

export function buildExecApprovalActionDescriptors(params: {
  approvalCommandId: string;
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): ExecApprovalActionDescriptor[] {
  const approvalCommandId = params.approvalCommandId.trim();
  if (!approvalCommandId) {
    return [];
  }
  const allowedDecisions = resolveAllowedDecisions(params);
  const descriptors: ExecApprovalActionDescriptor[] = [];
  if (allowedDecisions.includes("allow-once")) {
    descriptors.push({
      decision: "allow-once",
      label: "Allow Once",
      style: "success",
      command: buildExecApprovalCommandText({
        approvalCommandId,
        decision: "allow-once",
      }),
    });
  }
  if (allowedDecisions.includes("allow-always")) {
    descriptors.push({
      decision: "allow-always",
      label: "Allow Always",
      style: "primary",
      command: buildExecApprovalCommandText({
        approvalCommandId,
        decision: "allow-always",
      }),
    });
  }
  if (allowedDecisions.includes("deny")) {
    descriptors.push({
      decision: "deny",
      label: "Deny",
      style: "danger",
      command: buildExecApprovalCommandText({
        approvalCommandId,
        decision: "deny",
      }),
    });
  }
  return descriptors;
}

function buildApprovalInteractiveButtons(
  descriptors: readonly ExecApprovalActionDescriptor[],
): InteractiveReplyButton[] {
  return descriptors.map((descriptor) => ({
    label: descriptor.label,
    value: descriptor.command,
    style: descriptor.style,
  }));
}

function buildApprovalPresentationButtons(
  descriptors: readonly ExecApprovalActionDescriptor[],
): MessagePresentationButton[] {
  return descriptors.map((descriptor) => ({
    label: descriptor.label,
    value: descriptor.command,
    style: descriptor.style,
  }));
}

export function buildApprovalPresentationFromActionDescriptors(
  actions: readonly ExecApprovalActionDescriptor[],
): MessagePresentation | undefined {
  const buttons = buildApprovalPresentationButtons(actions);
  return buttons.length > 0 ? { blocks: [{ type: "buttons", buttons }] } : undefined;
}

export function buildApprovalPresentation(params: {
  approvalId: string;
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): MessagePresentation | undefined {
  return buildApprovalPresentationFromActionDescriptors(
    buildExecApprovalActionDescriptors({
      approvalCommandId: params.approvalId,
      ask: params.ask,
      allowedDecisions: params.allowedDecisions,
    }),
  );
}

export function buildExecApprovalPresentation(params: {
  approvalCommandId: string;
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): MessagePresentation | undefined {
  return buildApprovalPresentation({
    approvalId: params.approvalCommandId,
    ask: params.ask,
    allowedDecisions: params.allowedDecisions,
  });
}

export function buildApprovalInteractiveReplyFromActionDescriptors(
  actions: readonly ExecApprovalActionDescriptor[],
): InteractiveReply | undefined {
  const buttons = buildApprovalInteractiveButtons(actions);
  return buttons.length > 0 ? { blocks: [{ type: "buttons", buttons }] } : undefined;
}

export function buildApprovalInteractiveReply(params: {
  approvalId: string;
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): InteractiveReply | undefined {
  return buildApprovalInteractiveReplyFromActionDescriptors(
    buildExecApprovalActionDescriptors({
      approvalCommandId: params.approvalId,
      ask: params.ask,
      allowedDecisions: params.allowedDecisions,
    }),
  );
}

export function buildExecApprovalInteractiveReply(params: {
  approvalCommandId: string;
  ask?: string | null;
  allowedDecisions?: readonly ExecApprovalReplyDecision[];
}): InteractiveReply | undefined {
  return buildApprovalInteractiveReply({
    approvalId: params.approvalCommandId,
    ask: params.ask,
    allowedDecisions: params.allowedDecisions,
  });
}

function normalizeOptionalLowercaseString(value?: string | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

export function parseExecApprovalCommandText(
  raw: string,
): { approvalId: string; decision: ExecApprovalReplyDecision } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(
    /^\/?approve(?:@[^\s]+)?\s+([A-Za-z0-9][A-Za-z0-9._:-]*)\s+(allow-once|allow-always|always|deny)\b/i,
  );
  if (!match) {
    return null;
  }
  const rawDecision = normalizeOptionalLowercaseString(match[2]) ?? "";
  return {
    approvalId: match[1],
    decision:
      rawDecision === "always" ? "allow-always" : (rawDecision as ExecApprovalReplyDecision),
  };
}

export function formatExecApprovalExpiresIn(expiresAtMs: number, nowMs: number): string {
  const totalSeconds = Math.max(0, Math.round((expiresAtMs - nowMs) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (hours === 0 && minutes < 5 && seconds > 0) {
    parts.push(`${seconds}s`);
  }
  return parts.join(" ");
}

export function getExecApprovalReplyMetadata(
  payload: ReplyPayload,
): ExecApprovalReplyMetadata | null {
  const channelData = payload.channelData;
  if (!channelData || typeof channelData !== "object" || Array.isArray(channelData)) {
    return null;
  }
  const execApproval = channelData.execApproval;
  if (!execApproval || typeof execApproval !== "object" || Array.isArray(execApproval)) {
    return null;
  }
  const record = execApproval as Record<string, unknown>;
  const approvalId = typeof record.approvalId === "string" ? record.approvalId.trim() : "";
  const approvalSlug = typeof record.approvalSlug === "string" ? record.approvalSlug.trim() : "";
  if (!approvalId || !approvalSlug) {
    return null;
  }
  const approvalKind = record.approvalKind === "plugin" ? "plugin" : "exec";
  const allowedDecisions = Array.isArray(record.allowedDecisions)
    ? record.allowedDecisions.filter(
        (value): value is ExecApprovalReplyDecision =>
          value === "allow-once" || value === "allow-always" || value === "deny",
      )
    : undefined;
  const agentId = typeof record.agentId === "string" && record.agentId.trim() ? record.agentId.trim() : undefined;
  const sessionKey = typeof record.sessionKey === "string" && record.sessionKey.trim() ? record.sessionKey.trim() : undefined;
  return {
    approvalId,
    approvalSlug,
    approvalKind,
    agentId,
    allowedDecisions,
    sessionKey,
  };
}

export function buildExecApprovalPendingReplyPayload(
  params: ExecApprovalPendingReplyParams,
): ReplyPayload {
  const approvalCommandId = params.approvalCommandId?.trim() || params.approvalSlug;
  const allowedDecisions = params.allowedDecisions ?? ["allow-once", "allow-always", "deny"];
  const lines: string[] = [];
  const warningText = params.warningText?.trim();
  if (warningText) {
    lines.push(warningText);
  }
  lines.push("Approval required.");
  if (allowedDecisions.includes("allow-once")) {
    lines.push("Run:");
    lines.push(buildFence(`/approve ${approvalCommandId} allow-once`, "txt"));
  }
  lines.push("Pending command:");
  lines.push(buildFence(params.command, "sh"));
  const otherOptions: string[] = [];
  if (allowedDecisions.includes("allow-always")) {
    otherOptions.push(`/approve ${approvalCommandId} allow-always`);
  }
  if (allowedDecisions.includes("deny")) {
    otherOptions.push(`/approve ${approvalCommandId} deny`);
  }
  if (otherOptions.length > 0) {
    lines.push("Other options:");
    lines.push(buildFence(otherOptions.join("\n"), "txt"));
  }
  if (!allowedDecisions.includes("allow-always")) {
    lines.push(
      "The effective approval policy requires approval every time, so Allow Always is unavailable.",
    );
  }
  const info: string[] = [];
  info.push(`Host: ${params.host}`);
  if (params.nodeId) {
    info.push(`Node: ${params.nodeId}`);
  }
  if (params.cwd) {
    info.push(`CWD: ${params.cwd}`);
  }
  if (typeof params.expiresAtMs === "number" && Number.isFinite(params.expiresAtMs)) {
    const expiresInSec = Math.max(
      0,
      Math.round((params.expiresAtMs - (params.nowMs ?? Date.now())) / 1000),
    );
    info.push(`Expires in: ${expiresInSec}s`);
  }
  info.push(`Full id: \`${params.approvalId}\``);
  lines.push(info.join("\n"));

  return {
    text: lines.join("\n\n"),
    channelData: {
      execApproval: {
        approvalId: params.approvalId,
        approvalSlug: params.approvalSlug,
        allowedDecisions: [...allowedDecisions],
      },
    },
  };
}

export function buildExecApprovalUnavailableReplyPayload(
  params: ExecApprovalUnavailableReplyParams,
): ReplyPayload {
  const lines: string[] = [];
  const warningText = params.warningText?.trim();
  if (warningText) {
    lines.push(warningText);
  }

  if (params.sentApproverDms) {
    lines.push(getExecApprovalApproverDmNoticeText());
    return {
      text: lines.join("\n\n"),
    };
  }

  if (params.reason === "initiating-platform-disabled") {
    lines.push(
      `Exec approval is required, but chat exec approvals are not enabled on ${params.channelLabel ?? "this platform"}.`,
    );
    lines.push(
      "Approve it from the Web UI or terminal UI, or from Discord or Telegram if those approval clients are enabled.",
    );
  } else if (params.reason === "initiating-platform-unsupported") {
    lines.push(
      `Exec approval is required, but ${params.channelLabel ?? "this platform"} does not support chat exec approvals.`,
    );
    lines.push(
      "Approve it from the Web UI or terminal UI, or from Discord or Telegram if those approval clients are enabled.",
    );
  } else {
    lines.push(
      "Exec approval is required, but no interactive approval client is currently available.",
    );
    lines.push(
      "Open the Web UI or terminal UI, or enable Discord or Telegram exec approvals, then retry the command.",
    );
  }

  return {
    text: lines.join("\n\n"),
  };
}

// ---------------------------------------------------------------------------
// ExecApprovalReplyService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class ExecApprovalReplyService {
  buildApprovalPresentationFromActionDescriptors(
    ...args: Parameters<typeof buildApprovalPresentationFromActionDescriptors>
  ) {
    return buildApprovalPresentationFromActionDescriptors(...args);
  }

  buildApprovalPresentation(...args: Parameters<typeof buildApprovalPresentation>) {
    return buildApprovalPresentation(...args);
  }

  buildExecApprovalPresentation(...args: Parameters<typeof buildExecApprovalPresentation>) {
    return buildExecApprovalPresentation(...args);
  }

  buildApprovalInteractiveReplyFromActionDescriptors(
    ...args: Parameters<typeof buildApprovalInteractiveReplyFromActionDescriptors>
  ) {
    return buildApprovalInteractiveReplyFromActionDescriptors(...args);
  }

  buildApprovalInteractiveReply(...args: Parameters<typeof buildApprovalInteractiveReply>) {
    return buildApprovalInteractiveReply(...args);
  }

  buildExecApprovalInteractiveReply(
    ...args: Parameters<typeof buildExecApprovalInteractiveReply>
  ) {
    return buildExecApprovalInteractiveReply(...args);
  }

  parseExecApprovalCommandText(...args: Parameters<typeof parseExecApprovalCommandText>) {
    return parseExecApprovalCommandText(...args);
  }

  formatExecApprovalExpiresIn(...args: Parameters<typeof formatExecApprovalExpiresIn>) {
    return formatExecApprovalExpiresIn(...args);
  }

  buildExecApprovalCommandText(...args: Parameters<typeof buildExecApprovalCommandText>) {
    return buildExecApprovalCommandText(...args);
  }

  buildExecApprovalActionDescriptors(
    ...args: Parameters<typeof buildExecApprovalActionDescriptors>
  ) {
    return buildExecApprovalActionDescriptors(...args);
  }

  getExecApprovalApproverDmNoticeText() {
    return getExecApprovalApproverDmNoticeText();
  }

  getExecApprovalReplyMetadata(...args: Parameters<typeof getExecApprovalReplyMetadata>) {
    return getExecApprovalReplyMetadata(...args);
  }

  buildExecApprovalPendingReplyPayload(...args: Parameters<typeof buildExecApprovalPendingReplyPayload>) {
    return buildExecApprovalPendingReplyPayload(...args);
  }

  buildExecApprovalUnavailableReplyPayload(...args: Parameters<typeof buildExecApprovalUnavailableReplyPayload>) {
    return buildExecApprovalUnavailableReplyPayload(...args);
  }
}


const { getInstance: getExecApprovalReplyService, __testing: __testing_execApprovalReply } =
  createStandaloneSingleton({ create: () => new ExecApprovalReplyService(), defaultDeps: {} });

export { getExecApprovalReplyService, __testing_execApprovalReply };
