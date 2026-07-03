import type { ReplyToMode } from "../config/types.base.js";
import type { ChannelThreadingToolContext } from "../channels/plugins/types.js";

/**
 * Reply threading policy resolved from reply mode and context.
 * - "off": No threading
 * - "thread": Use specific thread ID
 * - "batched": Batch mode with optional first message reference
 */
export type ReplyThreadingPolicy =
  | { mode: "off" }
  | { mode: "thread"; threadId: string }
  | { mode: "batched"; firstMessageRef?: string };

/**
 * Resolve batched reply threading policy from reply mode and tool context.
 * Supports "batched" mode for Discord message batching.
 */
export function resolveBatchedReplyThreadingPolicy(params: {
  replyToMode: ReplyToMode;
  to: string;
  toolContext?: ChannelThreadingToolContext;
}): ReplyThreadingPolicy {
  if (params.replyToMode === "off") {
    return { mode: "off" };
  }
  if (params.replyToMode === "batched") {
    return { mode: "batched" };
  }
  // For "first" and "all" modes, use thread if available
  const threadId = params.toolContext?.currentThreadTs;
  if (threadId) {
    return { mode: "thread", threadId };
  }
  return { mode: "off" };
}
