import type { ReplyToMode } from "coreblow/plugin-sdk/account-core";
import type { ReplyThreadingPolicy } from "coreblow/plugin-sdk";
import { resolveBatchedReplyThreadingPolicy } from "coreblow/plugin-sdk";

type ReplyThreadingContext = {
  ReplyThreading?: ReplyThreadingPolicy;
};

export function applyImplicitReplyBatchGate(
  ctx: object,
  replyToMode: ReplyToMode,
  isBatched: boolean,
) {
  const replyThreading = resolveBatchedReplyThreadingPolicy(replyToMode, isBatched);
  if (!replyThreading) {
    return;
  }
  (ctx as ReplyThreadingContext).ReplyThreading = replyThreading;
}
