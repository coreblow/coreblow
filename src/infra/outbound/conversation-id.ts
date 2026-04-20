function normalizeConversationId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function resolveExplicitConversationTargetId(target: string): string | undefined {
  for (const prefix of ["channel:", "conversation:", "group:", "room:", "dm:"]) {
    if (target.toLowerCase().startsWith(prefix)) {
      return normalizeConversationId(target.slice(prefix.length));
    }
  }
  return undefined;
}

export function resolveConversationIdFromTargets(params: {
  threadId?: string | number;
  targets: Array<string | undefined | null>;
}): string | undefined {
  const threadId =
    params.threadId != null ? normalizeConversationId(String(params.threadId)) : undefined;
  if (threadId) {
    return threadId;
  }

  for (const rawTarget of params.targets) {
    const target = normalizeConversationId(rawTarget);
    if (!target) {
      continue;
    }
    const explicitConversationId = resolveExplicitConversationTargetId(target);
    if (explicitConversationId) {
      return explicitConversationId;
    }
    if (target.includes(":") && explicitConversationId === undefined) {
      continue;
    }
    const mentionMatch = target.match(/^<#(\d+)>$/);
    if (mentionMatch?.[1]) {
      return mentionMatch[1];
    }
    if (/^\d{6,}$/.test(target)) {
      return target;
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// ConversationIdService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "../service-patterns.js";

export class ConversationIdService {
  resolveConversationIdFromTargets(params: Parameters<typeof resolveConversationIdFromTargets>[0]) {
    return resolveConversationIdFromTargets(params);
  }
}

let _conversationIdInstance: ConversationIdService | null = null;

export function getConversationIdService(): ConversationIdService {
  if (!_conversationIdInstance) {
    _conversationIdInstance = new ConversationIdService();
  }
  return _conversationIdInstance;
}

export const __testing_conversationId = createTestingHooks<ConversationIdService>(
  () => { _conversationIdInstance = null; },
  (svc) => { _conversationIdInstance = svc; },
);
