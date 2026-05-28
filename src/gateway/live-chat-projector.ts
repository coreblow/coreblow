import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { stripInlineDirectiveTagsForDisplay } from "../utils/directive-tags.js";
import {
  isSuppressedControlReplyLeadFragment,
  isSuppressedControlReplyText,
} from "./control-reply-text.js";

export const MAX_LIVE_CHAT_BUFFER_CHARS = 500_000;

const COREBLOW_RUNTIME_CONTEXT_HEADER = "CoreBlow runtime context (internal):";
const COREBLOW_RUNTIME_CONTEXT_NOTICE =
  "This context is runtime-generated, not user-authored. Keep internal details private.";
const INTERNAL_TASK_EVENT_MARKER = "[Internal task completion event]";
const UNTRUSTED_RESULT_END = "<<<END_UNTRUSTED_CHILD_RESULT>>>";

function capLiveAssistantBuffer(text: string): string {
  if (text.length <= MAX_LIVE_CHAT_BUFFER_CHARS) {
    return text;
  }
  return text.slice(-MAX_LIVE_CHAT_BUFFER_CHARS);
}

function appendUniqueSuffix(base: string, suffix: string): string {
  if (!suffix) {
    return base;
  }
  if (!base) {
    return suffix;
  }
  if (base.endsWith(suffix)) {
    return base;
  }
  const maxOverlap = Math.min(base.length, suffix.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (base.slice(-overlap) === suffix.slice(0, overlap)) {
      return base + suffix.slice(overlap);
    }
  }
  return base + suffix;
}

export function resolveMergedAssistantText(params: {
  previousText: string;
  nextText: string;
  nextDelta: string;
}): string {
  const { previousText, nextText, nextDelta } = params;
  if (nextDelta && nextText === nextDelta) {
    return capLiveAssistantBuffer(previousText + nextDelta);
  }
  if (nextText && previousText) {
    if (nextText.startsWith(previousText)) {
      return capLiveAssistantBuffer(nextText);
    }
    if (previousText.startsWith(nextText) && !nextDelta) {
      return capLiveAssistantBuffer(previousText);
    }
  }
  if (nextDelta) {
    return capLiveAssistantBuffer(appendUniqueSuffix(previousText, nextDelta));
  }
  if (nextText) {
    return capLiveAssistantBuffer(nextText);
  }
  return capLiveAssistantBuffer(previousText);
}

function stripCoreBlowInternalRuntimeContext(text: string): string {
  const headerIndex = text.indexOf(COREBLOW_RUNTIME_CONTEXT_HEADER);
  if (headerIndex === -1 || !text.includes(INTERNAL_TASK_EVENT_MARKER, headerIndex)) {
    return text;
  }
  const resultEnd = text.indexOf(UNTRUSTED_RESULT_END, headerIndex);
  if (resultEnd === -1) {
    return text.slice(0, headerIndex).trimEnd();
  }
  const actionIndex = text.indexOf("\n\nAction:\n", resultEnd + UNTRUSTED_RESULT_END.length);
  const blockEnd =
    actionIndex === -1
      ? resultEnd + UNTRUSTED_RESULT_END.length
      : text.indexOf("\n\n", actionIndex + "\n\nAction:\n".length);
  const before = text.slice(0, headerIndex).trimEnd();
  const after = text.slice(blockEnd === -1 ? text.length : blockEnd).trimStart();
  return before && after ? `${before}\n\n${after}` : `${before}${after}`;
}

function normalizeLiveText(text: string): string {
  const strippedDirectives = stripInlineDirectiveTagsForDisplay(text).text;
  return stripCoreBlowInternalRuntimeContext(strippedDirectives);
}

export function normalizeLiveAssistantEventText(params: { text: string; delta?: unknown }): {
  text: string;
  delta: string;
} {
  return {
    text: normalizeLiveText(params.text),
    delta: typeof params.delta === "string" ? normalizeLiveText(params.delta) : "",
  };
}

function stripLeadingSilentToken(text: string, token: string = SILENT_REPLY_TOKEN): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`^(?:\\s*${escaped})+\\s*`, "i"), "").trim();
}

function startsWithAttachedSilentToken(
  text: string | undefined,
  token: string = SILENT_REPLY_TOKEN,
): boolean {
  if (!text) {
    return false;
  }
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*(?:${escaped}\\s+)*${escaped}(?=[\\p{L}\\p{N}])`, "iu").test(text);
}

export function projectLiveAssistantBufferedText(
  rawText: string,
  options?: { suppressLeadFragments?: boolean },
): {
  text: string;
  suppress: boolean;
  pendingLeadFragment: boolean;
} {
  if (!rawText) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (isSuppressedControlReplyText(rawText)) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (options?.suppressLeadFragments !== false && isSuppressedControlReplyLeadFragment(rawText)) {
    return { text: rawText, suppress: true, pendingLeadFragment: true };
  }
  const text = startsWithAttachedSilentToken(rawText, SILENT_REPLY_TOKEN)
    ? stripLeadingSilentToken(rawText, SILENT_REPLY_TOKEN)
    : rawText;
  if (!text || isSuppressedControlReplyText(text)) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (options?.suppressLeadFragments !== false && isSuppressedControlReplyLeadFragment(text)) {
    return { text, suppress: true, pendingLeadFragment: true };
  }
  return { text, suppress: false, pendingLeadFragment: false };
}

export function shouldSuppressAssistantEventForLiveChat(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }
  const entry = data as { phase?: unknown; message?: { phase?: unknown } };
  return entry.phase === "commentary" || entry.message?.phase === "commentary";
}
