import { createHash } from "node:crypto";

function looksLikeConnectionBoundId(id: string): boolean {
  if (id.length < 24) {
    return false;
  }
  if (/^(?:rs|msg|fc)_[A-Za-z0-9_-]+$/.test(id)) {
    return false;
  }
  if (!/^[A-Za-z0-9+/_-]+=*$/.test(id)) {
    return false;
  }
  return Buffer.from(id, "base64").length >= 16;
}

function deriveReplacementId(type: string | undefined, originalId: string): string {
  const prefix = type === "function_call" ? "fc" : "msg";
  const hex = createHash("sha256").update(originalId).digest("hex").slice(0, 16);
  return `${prefix}_${hex}`;
}

type InputItem = Record<string, unknown> & { id?: unknown; type?: unknown };

function isInputItem(value: unknown): value is InputItem {
  return !!value && typeof value === "object";
}

function isValidReasoningReplayId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

export function sanitizeCopilotReplayResponseIds(input: unknown): boolean {
  if (!Array.isArray(input)) {
    return false;
  }
  let rewrote = false;
  for (let index = input.length - 1; index >= 0; index -= 1) {
    const item = input[index];
    if (!isInputItem(item)) {
      continue;
    }
    const id = item.id;
    if (item.type === "reasoning") {
      if (!isValidReasoningReplayId(id)) {
        input.splice(index, 1);
        rewrote = true;
      }
      continue;
    }
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (looksLikeConnectionBoundId(id)) {
      item.id = deriveReplacementId(typeof item.type === "string" ? item.type : undefined, id);
      rewrote = true;
    }
  }
  return rewrote;
}

export function rewriteCopilotConnectionBoundResponseIds(input: unknown): boolean {
  return sanitizeCopilotReplayResponseIds(input);
}

export function sanitizeCopilotReplayResponsePayloadIds(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  return sanitizeCopilotReplayResponseIds((payload as { input?: unknown }).input);
}

export function rewriteCopilotResponsePayloadConnectionBoundIds(payload: unknown): boolean {
  return sanitizeCopilotReplayResponsePayloadIds(payload);
}
