import { randomUUID } from "node:crypto";

type LmstudioPlainTextToolCallBlock = {
  arguments: Record<string, unknown>;
  name: string;
};

const MAX_PAYLOAD_CHARS = 256_000;
const END_TOOL_REQUEST = "[END_TOOL_REQUEST]";

function isToolNameChar(char: string | undefined): boolean {
  return Boolean(char && /[A-Za-z0-9_-]/.test(char));
}

function skipWhitespace(text: string, start: number): number {
  let index = start;
  while (index < text.length && /\s/.test(text[index] ?? "")) {
    index += 1;
  }
  return index;
}

function consumeJsonObject(
  text: string,
  start: number,
): { end: number; value: Record<string, unknown> } | null {
  const cursor = skipWhitespace(text, start);
  if (text[cursor] !== "{") {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = cursor; index < text.length; index += 1) {
    const char = text[index];
    if (index + 1 - cursor > MAX_PAYLOAD_CHARS) {
      return null;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const raw = text.slice(cursor, index + 1);
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
          }
          return { end: index + 1, value: parsed as Record<string, unknown> };
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function parseBlockAt(
  text: string,
  start: number,
  allowedToolNames: Set<string>,
): { block: LmstudioPlainTextToolCallBlock; end: number } | null {
  if (text[start] !== "[") {
    return null;
  }
  let cursor = start + 1;
  const nameStart = cursor;
  while (isToolNameChar(text[cursor])) {
    cursor += 1;
  }
  if (cursor === nameStart || text[cursor] !== "]") {
    return null;
  }
  const name = text.slice(nameStart, cursor);
  if (!allowedToolNames.has(name)) {
    return null;
  }
  cursor += 1;
  const payload = consumeJsonObject(text, cursor);
  if (!payload) {
    return null;
  }
  const closeStart = skipWhitespace(text, payload.end);
  if (!text.startsWith(END_TOOL_REQUEST, closeStart)) {
    return null;
  }
  return {
    block: { arguments: payload.value, name },
    end: closeStart + END_TOOL_REQUEST.length,
  };
}

export function parseLmstudioPlainTextToolCalls(
  text: string,
  allowedToolNames: Set<string>,
): LmstudioPlainTextToolCallBlock[] | null {
  if (allowedToolNames.size === 0) {
    return null;
  }
  const blocks: LmstudioPlainTextToolCallBlock[] = [];
  let cursor = skipWhitespace(text, 0);
  while (cursor < text.length) {
    const parsed = parseBlockAt(text, cursor, allowedToolNames);
    if (!parsed) {
      return null;
    }
    blocks.push(parsed.block);
    cursor = skipWhitespace(text, parsed.end);
  }
  return blocks.length > 0 ? blocks : null;
}

export function createLmstudioSyntheticToolCallId(): string {
  return `call_${randomUUID().replace(/-/gu, "").slice(0, 24)}`;
}
