import type { ReplyToMode } from "coreblow/plugin-sdk/account-resolution";
import { isSingleUseReplyToMode } from "coreblow/plugin-sdk/outbound-runtime";
import { parseSlackTarget } from "./targets.js";

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function resolveSlackAutoThreadId(params: {
  to: string;
  toolContext?: {
    currentChannelId?: string;
    currentThreadTs?: string;
    replyToMode?: ReplyToMode;
    hasRepliedRef?: { value: boolean };
    sameChannelThreadRequired?: boolean;
  };
}): string | undefined {
  const context = params.toolContext;
  if (!context?.currentChannelId) {
    return undefined;
  }
  const parsedTarget = parseSlackTarget(params.to, { defaultKind: "channel" });
  if (!parsedTarget || parsedTarget.kind !== "channel") {
    return undefined;
  }
  if (
    normalizeLowercaseStringOrEmpty(parsedTarget.id) !==
    normalizeLowercaseStringOrEmpty(context.currentChannelId)
  ) {
    return undefined;
  }
  if (!context.currentThreadTs) {
    if (context.sameChannelThreadRequired) {
      throw new Error(
        "Slack thread context is required for same-channel replies from a threaded Slack turn. Set topLevel=true or threadId=null to post at the channel root.",
      );
    }
    return undefined;
  }
  if (context.replyToMode !== "all" && !isSingleUseReplyToMode(context.replyToMode ?? "off")) {
    return undefined;
  }
  if (isSingleUseReplyToMode(context.replyToMode ?? "off") && context.hasRepliedRef?.value) {
    return undefined;
  }
  return context.currentThreadTs;
}
