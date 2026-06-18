import type {
  PermissionOption,
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@agentclientprotocol/sdk";

export type GatewayExecApprovalDecision = "allow-once" | "allow-always" | "deny";

export type GatewayExecApprovalEvent = {
  approvalId: string;
  command?: string;
  host?: string;
  title?: string;
  toolCallId?: string;
};

export type GatewayExecApprovalDetails = {
  allowedDecisions?: unknown;
  commandPreview?: unknown;
  commandText?: unknown;
  host?: unknown;
};

const FALLBACK_DECISIONS = ["allow-once", "deny"] as const;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDecision(value: unknown): GatewayExecApprovalDecision | undefined {
  return value === "allow-once" || value === "allow-always" || value === "deny"
    ? value
    : undefined;
}

export function normalizeGatewayExecApprovalDecisions(
  value: unknown,
): GatewayExecApprovalDecision[] {
  const decisions = Array.isArray(value)
    ? value.map(readDecision).filter((item): item is GatewayExecApprovalDecision => Boolean(item))
    : [];
  return decisions.length > 0 ? decisions : [...FALLBACK_DECISIONS];
}

export function buildAcpPermissionOptions(
  decisions: readonly GatewayExecApprovalDecision[],
): PermissionOption[] {
  const unique = new Set(decisions);
  const options: PermissionOption[] = [];
  if (unique.has("allow-once")) {
    options.push({ optionId: "allow-once", name: "Allow once", kind: "allow_once" });
  }
  if (unique.has("allow-always")) {
    options.push({ optionId: "allow-always", name: "Allow always", kind: "allow_always" });
  }
  if (unique.has("deny")) {
    options.push({ optionId: "deny", name: "Deny", kind: "reject_once" });
  }
  return options.length > 0 ? options : buildAcpPermissionOptions(FALLBACK_DECISIONS);
}

export function parseGatewayExecApprovalEventData(
  data: Record<string, unknown>,
): GatewayExecApprovalEvent | null {
  if (data.phase !== "requested" || data.kind !== "exec" || data.status !== "pending") {
    return null;
  }
  const approvalId = readString(data.approvalId);
  if (!approvalId) {
    return null;
  }
  return {
    approvalId,
    command: readString(data.command),
    host: readString(data.host),
    title: readString(data.title),
    toolCallId: readString(data.toolCallId),
  };
}

export function parseGatewayExecApprovalRequestEventPayload(
  payload: Record<string, unknown>,
): GatewayExecApprovalEvent | null {
  const approvalId = readString(payload.id);
  const request = payload.request;
  if (!approvalId || !request || typeof request !== "object" || Array.isArray(request)) {
    return null;
  }
  const details = request as Record<string, unknown>;
  return {
    approvalId,
    command: readString(details.command) ?? readString(details.commandPreview),
    host: readString(details.host),
  };
}

export function buildAcpPermissionRequest(params: {
  sessionId: string;
  event: GatewayExecApprovalEvent;
  details?: GatewayExecApprovalDetails | null;
}): RequestPermissionRequest {
  const command =
    readString(params.details?.commandText) ??
    readString(params.details?.commandPreview) ??
    params.event.command;
  const host = readString(params.details?.host) ?? params.event.host;
  const rawInput: Record<string, string> = {
    name: "exec",
    approvalId: params.event.approvalId,
    ...(command ? { command } : {}),
    ...(host ? { host } : {}),
  };

  return {
    sessionId: params.sessionId,
    toolCall: {
      toolCallId: params.event.toolCallId ?? `exec:${params.event.approvalId}`,
      title: params.event.title ?? "Command approval requested",
      kind: "execute",
      status: "pending",
      rawInput,
      _meta: { toolName: "exec", approvalId: params.event.approvalId },
    },
    options: buildAcpPermissionOptions(
      normalizeGatewayExecApprovalDecisions(params.details?.allowedDecisions),
    ),
  };
}

export function resolveGatewayDecisionFromPermissionOutcome(
  response: RequestPermissionResponse | undefined,
  options: readonly PermissionOption[],
): GatewayExecApprovalDecision | undefined {
  const outcome = response?.outcome;
  if (!outcome || outcome.outcome !== "selected") {
    return undefined;
  }
  return readDecision(options.find((option) => option.optionId === outcome.optionId)?.optionId);
}
