import type { AgentMessage } from "@mariozechner/pi-agent-core";

export const INPUT_PROVENANCE_KIND_VALUES = [
  "external_user",
  "inter_session",
  "internal_system",
] as const;

export type InputProvenanceKind = (typeof INPUT_PROVENANCE_KIND_VALUES)[number];

export type InputProvenance = {
  kind: InputProvenanceKind;
  originSessionId?: string;
  sourceSessionKey?: string;
  sourceChannel?: string;
  sourceTool?: string;
};

const INTER_SESSION_MARKER = "[Inter-session message]";

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isInputProvenanceKind(value: unknown): value is InputProvenanceKind {
  return (
    typeof value === "string" && (INPUT_PROVENANCE_KIND_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeInputProvenance(value: unknown): InputProvenance | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (!isInputProvenanceKind(record.kind)) {
    return undefined;
  }
  return {
    kind: record.kind,
    originSessionId: normalizeOptionalString(record.originSessionId),
    sourceSessionKey: normalizeOptionalString(record.sourceSessionKey),
    sourceChannel: normalizeOptionalString(record.sourceChannel),
    sourceTool: normalizeOptionalString(record.sourceTool),
  };
}

export function applyInputProvenanceToUserMessage(
  message: AgentMessage,
  inputProvenance: InputProvenance | undefined,
): AgentMessage {
  if (!inputProvenance) {
    return message;
  }
  if ((message as { role?: unknown }).role !== "user") {
    return message;
  }
  const existing = normalizeInputProvenance((message as { provenance?: unknown }).provenance);
  if (existing) {
    return message;
  }
  return {
    ...(message as unknown as Record<string, unknown>),
    provenance: inputProvenance,
  } as unknown as AgentMessage;
}

export function isInterSessionInputProvenance(value: unknown): boolean {
  return normalizeInputProvenance(value)?.kind === "inter_session";
}

export function hasInterSessionUserProvenance(
  message: { role?: unknown; provenance?: unknown } | undefined,
): boolean {
  if (!message || message.role !== "user") {
    return false;
  }
  return isInterSessionInputProvenance(message.provenance);
}

export function annotateInterSessionPromptText(
  text: string,
  inputProvenance: InputProvenance | undefined,
): string {
  if (!inputProvenance || inputProvenance.kind !== "inter_session") {
    return text;
  }

  const withoutExistingMarker = text
    .replace(/^\s*\[Inter-session message\][^\n]*(?:\n|$)/u, "")
    .replace(/\n+\[Inter-session message\][^\n]*(?:\n|$)/gu, "\n")
    .trimStart();
  const fields = [
    inputProvenance.originSessionId ? `originSession=${inputProvenance.originSessionId}` : null,
    inputProvenance.sourceSessionKey ? `sourceSession=${inputProvenance.sourceSessionKey}` : null,
    inputProvenance.sourceChannel ? `sourceChannel=${inputProvenance.sourceChannel}` : null,
    inputProvenance.sourceTool ? `sourceTool=${inputProvenance.sourceTool}` : null,
    "isUser=false",
  ].filter(Boolean);

  return `${INTER_SESSION_MARKER} ${fields.join(" ")}\n${withoutExistingMarker}`;
}
