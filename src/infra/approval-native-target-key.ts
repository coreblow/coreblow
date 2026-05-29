import type { ChannelApprovalNativeTarget } from "../channels/plugins/approval-native.types.js";

function normalizeTargetPart(value: string): string {
  return value.trim();
}

function normalizeThreadId(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.trunc(value)) : "";
  }
  return value?.trim() ?? "";
}

export function buildChannelApprovalNativeTargetKey(target: ChannelApprovalNativeTarget): string {
  return JSON.stringify([normalizeTargetPart(target.to), normalizeThreadId(target.threadId)]);
}
