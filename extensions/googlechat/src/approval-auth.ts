import { normalizeGoogleChatTarget, isGoogleChatUserTarget } from "./targets.js";

export function normalizeGoogleChatApproverId(value: string | number): string | undefined {
  const normalized = normalizeGoogleChatTarget(String(value));
  if (!normalized || !isGoogleChatUserTarget(normalized)) {
    return undefined;
  }
  const suffix = normalized.slice("users/".length).trim().toLowerCase();
  if (!suffix || suffix.includes("@")) {
    return undefined;
  }
  return `users/${suffix}`;
}

export const googleChatApprovalAuth = {
  normalizeSenderId: normalizeGoogleChatApproverId,
};
