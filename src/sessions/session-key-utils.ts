import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
  normalizeOptionalString,
} from "../shared/string-coerce.js";

export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export type ParsedThreadSessionSuffix = {
  baseSessionKey: string | undefined;
  threadId: string | undefined;
};

export type SessionKeyChatType = "direct" | "group" | "channel" | "unknown";

export type RawSessionConversationRef = {
  channel: string;
  kind: "group" | "channel";
  rawId: string;
  prefix: string;
};

export function normalizeSessionPeerId(params: {
  channel: string | undefined | null;
  peerKind?: string | null;
  peerId?: string | null;
}): string {
  const peerId = (params.peerId ?? "").trim();
  if (!peerId) {
    return "";
  }
  const channel = normalizeLowercaseStringOrEmpty(params.channel);
  const peerKind = normalizeLowercaseStringOrEmpty(params.peerKind);
  return channel === "signal" && peerKind === "group"
    ? peerId
    : normalizeLowercaseStringOrEmpty(peerId);
}

const SIGNAL_GROUP_SESSION_SEGMENT_RE = /(^|:)signal:group:([^:]+)/gi;

export function normalizeSessionKeyPreservingOpaquePeerIds(
  sessionKey: string | undefined | null,
): string {
  const raw = normalizeOptionalString(sessionKey);
  if (!raw) {
    return "";
  }

  let normalized = "";
  let cursor = 0;
  for (const match of raw.matchAll(SIGNAL_GROUP_SESSION_SEGMENT_RE)) {
    const matchIndex = match.index ?? 0;
    const matched = match[0] ?? "";
    const peerId = match[2] ?? "";
    const peerStart = matchIndex + matched.length - peerId.length;
    normalized += normalizeLowercaseStringOrEmpty(raw.slice(cursor, peerStart));
    normalized += peerId.trim();
    cursor = matchIndex + matched.length;
  }
  normalized += normalizeLowercaseStringOrEmpty(raw.slice(cursor));
  return normalized;
}

/**
 * Parse agent-scoped session keys in a canonical, case-insensitive way.
 * Returned values are normalized for stable comparisons/routing while
 * preserving provider-owned opaque peer IDs.
 */
export function parseAgentSessionKey(
  sessionKey: string | undefined | null,
): ParsedAgentSessionKey | null {
  const raw = normalizeSessionKeyPreservingOpaquePeerIds(sessionKey);
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== "agent") {
    return null;
  }
  const agentId = parts[1]?.trim();
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

/**
 * Best-effort chat-type extraction from session keys across canonical and legacy formats.
 */
export function deriveSessionChatType(sessionKey: string | undefined | null): SessionKeyChatType {
  const raw = (sessionKey ?? "").trim().toLowerCase();
  if (!raw) {
    return "unknown";
  }
  const scoped = parseAgentSessionKey(raw)?.rest ?? raw;
  const tokens = new Set(scoped.split(":").filter(Boolean));
  if (tokens.has("group")) {
    return "group";
  }
  if (tokens.has("channel")) {
    return "channel";
  }
  if (tokens.has("direct") || tokens.has("dm")) {
    return "direct";
  }
  // Legacy Discord keys can be shaped like:
  // discord:<accountId>:guild-<guildId>:channel-<channelId>
  if (/^discord:(?:[^:]+:)?guild-[^:]+:channel-[^:]+$/.test(scoped)) {
    return "channel";
  }
  return "unknown";
}

export function isCronRunSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return /^cron:[^:]+:run:[^:]+$/.test(parsed.rest);
}

export function isCronSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return parsed.rest.toLowerCase().startsWith("cron:");
}

export function isSubagentSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  if (raw.toLowerCase().startsWith("subagent:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("subagent:"));
}

export function getSubagentDepth(sessionKey: string | undefined | null): number {
  const raw = (sessionKey ?? "").trim().toLowerCase();
  if (!raw) {
    return 0;
  }
  return raw.split(":subagent:").length - 1;
}

export function isAcpSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("acp:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("acp:"));
}

const THREAD_SESSION_MARKERS = [":thread:", ":topic:"];

export function resolveThreadParentSessionKey(
  sessionKey: string | undefined | null,
): string | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  let idx = -1;
  for (const marker of THREAD_SESSION_MARKERS) {
    const candidate = normalized.lastIndexOf(marker);
    if (candidate > idx) {
      idx = candidate;
    }
  }
  if (idx <= 0) {
    return null;
  }
  const parent = raw.slice(0, idx).trim();
  return parent ? parent : null;
}

export function parseRawSessionConversationRef(
  sessionKey: string | undefined | null,
): RawSessionConversationRef | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }

  const rawParts = raw.split(":").filter(Boolean);
  const bodyStartIndex =
    rawParts.length >= 3 && rawParts[0].trim().toLowerCase() === "agent" ? 2 : 0;
  const parts = rawParts.slice(bodyStartIndex);
  if (parts.length < 3) {
    return null;
  }

  const channel = parts[0].trim().toLowerCase();
  const kind = parts[1].trim().toLowerCase();
  if (!channel || (kind !== "group" && kind !== "channel")) {
    return null;
  }

  const rawId = parts.slice(2).join(":").trim();
  const prefix = rawParts.slice(0, bodyStartIndex + 2).join(":").trim();
  if (!rawId || !prefix) {
    return null;
  }

  return { channel, kind, rawId, prefix };
}
