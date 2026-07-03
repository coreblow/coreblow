import type { ReplyToMode } from "coreblow/plugin-sdk/account-resolution";
import { parseSlackTarget } from "./targets.js";

export function resolveSlackAutoThreadId(params: {
  to: string;
  toolContext?: {
    currentChannelId?: string;
    currentThreadTs?: string;
    replyToMode?: ReplyToMode;
    hasRepliedRef?: { value: boolean };
  };
}): string | undefined {
  const context = params.toolContext;
  if (!context?.currentThreadTs || !context.currentChannelId) {
    return undefined;
  }
  if (context.replyToMode !== "all" && context.replyToMode !== "first") {
    return undefined;
  }
  const parsedTarget = parseSlackTarget(params.to, { defaultKind: "channel" });
  if (!parsedTarget || parsedTarget.kind !== "channel") {
    return undefined;
  }
  if (parsedTarget.id.toLowerCase() !== context.currentChannelId.toLowerCase()) {
    return undefined;
  }
  if (context.replyToMode === "first" && context.hasRepliedRef?.value) {
    return undefined;
  }
  return context.currentThreadTs;
}
