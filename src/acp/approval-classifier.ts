import { homedir } from "node:os";
import path from "node:path";
import { isKnownCoreToolId } from "../agents/tool-catalog.js";
import { isMutatingToolCall } from "../agents/tool-mutation.js";
import { isPathInside } from "../infra/path-guards.js";
import { DANGEROUS_ACP_TOOLS } from "../security/dangerous-tools.js";
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalString,
} from "../shared/string-coerce.js";
import { asRecord } from "./record-shared.js";

const SAFE_SEARCH_TOOL_IDS = new Set(["search", "web_search", "memory_search"]);
const TRUSTED_SAFE_TOOL_ALIASES = new Set(["search"]);
const EXEC_CAPABLE_TOOL_IDS = new Set([
  "exec",
  "spawn",
  "shell",
  "bash",
  "process",
  "code_execution",
]);
const CONTROL_PLANE_TOOL_IDS = new Set(["sessions_spawn", "sessions_send", "session_status"]);

export type AcpApprovalClass =
  | "readonly_scoped"
  | "readonly_search"
  | "mutating"
  | "exec_capable"
  | "control_plane"
  | "interactive"
  | "other"
  | "unknown";

export type AcpApprovalClassification = {
  toolName?: string;
  approvalClass: AcpApprovalClass;
  autoApprove: boolean;
};

function readFirstStringValue(
  source: Record<string, unknown> | undefined,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = normalizeOptionalString(source?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

function normalizeToolName(value: string): string | undefined {
  const normalized = normalizeLowercaseStringOrEmpty(value);
  return normalized && normalized.length <= 128 && /^[a-z0-9._-]+$/.test(normalized)
    ? normalized
    : undefined;
}

function parseToolNameFromTitle(title?: string | null): string | undefined {
  const head = normalizeOptionalString(title?.split(":", 1)[0]);
  return head ? normalizeToolName(head) : undefined;
}

function resolveToolName(toolCall?: {
  title?: string | null;
  _meta?: unknown;
  rawInput?: unknown;
}): string | undefined {
  const metaNameRaw = readFirstStringValue(asRecord(toolCall?._meta), [
    "toolName",
    "tool_name",
    "name",
  ]);
  const inputNameRaw = readFirstStringValue(asRecord(toolCall?.rawInput), [
    "tool",
    "toolName",
    "tool_name",
    "name",
  ]);
  const metaName = metaNameRaw ? normalizeToolName(metaNameRaw) : undefined;
  const inputName = inputNameRaw ? normalizeToolName(inputNameRaw) : undefined;
  const titleName = parseToolNameFromTitle(toolCall?.title);
  if ((metaNameRaw && !metaName) || (inputNameRaw && !inputName)) {
    return undefined;
  }
  const names = [metaName, inputName, titleName].filter((name): name is string => Boolean(name));
  return new Set(names).size <= 1 ? names[0] : undefined;
}

function resolveReadPath(
  toolCall: { title?: string | null; rawInput?: unknown } | undefined,
): string | undefined {
  const rawInput = asRecord(toolCall?.rawInput);
  const fromInput = readFirstStringValue(rawInput, ["path", "file_path", "filePath"]);
  if (fromInput) {
    return fromInput;
  }
  const title = toolCall?.title;
  const separator = title?.indexOf(":") ?? -1;
  return separator >= 0 ? normalizeOptionalString(title?.slice(separator + 1)) : undefined;
}

function resolveAbsolutePath(value: string, cwd: string): string | undefined {
  let candidate = value.trim();
  if (candidate.startsWith("file://")) {
    try {
      candidate = decodeURIComponent(new URL(candidate).pathname);
    } catch {
      return undefined;
    }
  } else if (candidate === "~") {
    candidate = homedir();
  } else if (candidate.startsWith("~/")) {
    candidate = path.join(homedir(), candidate.slice(2));
  }
  return candidate ? path.resolve(cwd, candidate) : undefined;
}

export function classifyAcpToolApproval(params: {
  toolCall?: { title?: string | null; _meta?: unknown; rawInput?: unknown };
  cwd: string;
}): AcpApprovalClassification {
  const toolName = resolveToolName(params.toolCall);
  if (!toolName) {
    return { approvalClass: "unknown", autoApprove: false };
  }

  const trusted = isKnownCoreToolId(toolName) || TRUSTED_SAFE_TOOL_ALIASES.has(toolName);
  if (toolName === "read" && trusted) {
    const rawPath = resolveReadPath(params.toolCall);
    const absolutePath = rawPath ? resolveAbsolutePath(rawPath, params.cwd) : undefined;
    const autoApprove = Boolean(absolutePath && isPathInside(params.cwd, absolutePath));
    return {
      toolName,
      approvalClass: autoApprove ? "readonly_scoped" : "other",
      autoApprove,
    };
  }
  if (SAFE_SEARCH_TOOL_IDS.has(toolName) && trusted) {
    return { toolName, approvalClass: "readonly_search", autoApprove: true };
  }
  if (EXEC_CAPABLE_TOOL_IDS.has(toolName) || DANGEROUS_ACP_TOOLS.has(toolName)) {
    return { toolName, approvalClass: "exec_capable", autoApprove: false };
  }
  if (CONTROL_PLANE_TOOL_IDS.has(toolName)) {
    return { toolName, approvalClass: "control_plane", autoApprove: false };
  }
  if (isMutatingToolCall(toolName, params.toolCall?.rawInput)) {
    return { toolName, approvalClass: "mutating", autoApprove: false };
  }
  return { toolName, approvalClass: "other", autoApprove: false };
}
