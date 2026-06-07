import { stripInlineDirectiveTagsForDisplay } from "../utils/directive-tags.js";
import { stripEnvelopeFromMessages } from "./chat-sanitize.js";
import { isSuppressedControlReplyText } from "./control-reply-text.js";

export const DEFAULT_CHAT_HISTORY_TEXT_MAX_CHARS = 12_000;

function truncateChatHistoryText(
  text: string,
  maxChars: number = DEFAULT_CHAT_HISTORY_TEXT_MAX_CHARS,
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: `${text.slice(0, maxChars)}\n...(truncated)...`,
    truncated: true,
  };
}

function sanitizeChatHistoryContentBlock(
  block: unknown,
  maxChars: number,
): { block: unknown; changed: boolean } {
  if (!block || typeof block !== "object") {
    return { block, changed: false };
  }
  const entry = { ...(block as Record<string, unknown>) };
  let changed = false;
  if (typeof entry.text === "string") {
    const stripped = stripInlineDirectiveTagsForDisplay(entry.text);
    const res = truncateChatHistoryText(stripped.text, maxChars);
    entry.text = res.text;
    changed ||= stripped.changed || res.truncated;
  }
  if (typeof entry.partialJson === "string") {
    const res = truncateChatHistoryText(entry.partialJson, maxChars);
    entry.partialJson = res.text;
    changed ||= res.truncated;
  }
  if (typeof entry.arguments === "string") {
    const res = truncateChatHistoryText(entry.arguments, maxChars);
    entry.arguments = res.text;
    changed ||= res.truncated;
  }
  if (typeof entry.thinking === "string") {
    const res = truncateChatHistoryText(entry.thinking, maxChars);
    entry.thinking = res.text;
    changed ||= res.truncated;
  }
  if ("thinkingSignature" in entry) {
    delete entry.thinkingSignature;
    changed = true;
  }
  const type = typeof entry.type === "string" ? entry.type : "";
  if (type === "image" && typeof entry.data === "string") {
    const bytes = Buffer.byteLength(entry.data, "utf8");
    delete entry.data;
    entry.omitted = true;
    entry.bytes = bytes;
    changed = true;
  }
  if (type === "audio" && entry.source && typeof entry.source === "object") {
    const source = { ...(entry.source as Record<string, unknown>) };
    if (source.type === "base64" && typeof source.data === "string") {
      const bytes = Buffer.byteLength(source.data, "utf8");
      delete source.data;
      source.omitted = true;
      source.bytes = bytes;
      entry.source = source;
      changed = true;
    }
  }
  return { block: changed ? entry : block, changed };
}

function toFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeCost(raw: unknown): { total?: number } | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const total = toFiniteNumber((raw as Record<string, unknown>).total);
  return total !== undefined ? { total } : undefined;
}

function sanitizeUsage(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const usage = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const key of [
    "input",
    "output",
    "totalTokens",
    "inputTokens",
    "outputTokens",
    "cacheRead",
    "cacheWrite",
    "cache_read_input_tokens",
    "cache_creation_input_tokens",
  ]) {
    const value = toFiniteNumber(usage[key]);
    if (value !== undefined) {
      out[key] = value;
    }
  }
  const cost = sanitizeCost(usage.cost);
  if (cost) {
    (out as Record<string, unknown>).cost = cost;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeChatHistoryMessage(
  message: unknown,
  maxChars: number,
): { message: unknown; changed: boolean } {
  if (!message || typeof message !== "object") {
    return { message, changed: false };
  }
  const entry = { ...(message as Record<string, unknown>) };
  let changed = false;

  if ("details" in entry) {
    delete entry.details;
    changed = true;
  }
  if (entry.role !== "assistant") {
    if ("usage" in entry) {
      delete entry.usage;
      changed = true;
    }
    if ("cost" in entry) {
      delete entry.cost;
      changed = true;
    }
  } else {
    if ("usage" in entry) {
      const usage = sanitizeUsage(entry.usage);
      if (usage) {
        entry.usage = usage;
      } else {
        delete entry.usage;
      }
      changed = true;
    }
    if ("cost" in entry) {
      const cost = sanitizeCost(entry.cost);
      if (cost) {
        entry.cost = cost;
      } else {
        delete entry.cost;
      }
      changed = true;
    }
  }
  if (typeof entry.content === "string") {
    const stripped = stripInlineDirectiveTagsForDisplay(entry.content);
    const res = truncateChatHistoryText(stripped.text, maxChars);
    entry.content = res.text;
    changed ||= stripped.changed || res.truncated;
  } else if (Array.isArray(entry.content)) {
    const content = entry.content.map((block) => sanitizeChatHistoryContentBlock(block, maxChars));
    if (content.some((block) => block.changed)) {
      entry.content = content.map((block) => block.block);
      changed = true;
    }
  }
  if (typeof entry.text === "string") {
    const stripped = stripInlineDirectiveTagsForDisplay(entry.text);
    const res = truncateChatHistoryText(stripped.text, maxChars);
    entry.text = res.text;
    changed ||= stripped.changed || res.truncated;
  }
  return { message: changed ? entry : message, changed };
}

function extractAssistantTextForControlCheck(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  const entry = message as Record<string, unknown>;
  if (entry.role !== "assistant") {
    return undefined;
  }
  if (typeof entry.text === "string") {
    return entry.text;
  }
  if (typeof entry.content === "string") {
    return entry.content;
  }
  if (!Array.isArray(entry.content) || entry.content.length === 0) {
    return undefined;
  }
  const texts: string[] = [];
  for (const block of entry.content) {
    if (!block || typeof block !== "object") {
      return undefined;
    }
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type !== "text" || typeof typed.text !== "string") {
      return undefined;
    }
    texts.push(typed.text);
  }
  return texts.length > 0 ? texts.join("\n") : undefined;
}

export function sanitizeChatHistoryMessages(
  messages: unknown[],
  maxChars: number = DEFAULT_CHAT_HISTORY_TEXT_MAX_CHARS,
): unknown[] {
  if (messages.length === 0) {
    return messages;
  }
  let changed = false;
  const visible: unknown[] = [];
  for (const message of messages) {
    const sanitized = sanitizeChatHistoryMessage(message, maxChars);
    changed ||= sanitized.changed;
    const text = extractAssistantTextForControlCheck(sanitized.message);
    if (text !== undefined && isSuppressedControlReplyText(text)) {
      changed = true;
      continue;
    }
    visible.push(sanitized.message);
  }
  return changed ? visible : messages;
}

export function projectChatDisplayMessages(
  messages: unknown[],
  options?: { maxChars?: number; stripEnvelope?: boolean },
): Array<Record<string, unknown>> {
  const source = options?.stripEnvelope === false ? messages : stripEnvelopeFromMessages(messages);
  return sanitizeChatHistoryMessages(source, options?.maxChars).filter(
    (message): message is Record<string, unknown> =>
      Boolean(message) && typeof message === "object" && !Array.isArray(message),
  );
}

export function projectRecentChatDisplayMessages(
  messages: unknown[],
  options?: { maxChars?: number; maxMessages?: number; stripEnvelope?: boolean },
): Array<Record<string, unknown>> {
  const projected = projectChatDisplayMessages(messages, options);
  if (
    typeof options?.maxMessages !== "number" ||
    !Number.isFinite(options.maxMessages) ||
    options.maxMessages <= 0 ||
    projected.length <= options.maxMessages
  ) {
    return projected;
  }
  return projected.slice(-Math.floor(options.maxMessages));
}

export function projectChatDisplayMessage(
  message: unknown,
  options?: { maxChars?: number; stripEnvelope?: boolean },
): Record<string, unknown> | undefined {
  return projectChatDisplayMessages([message], options)[0];
}
