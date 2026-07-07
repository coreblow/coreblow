import type { ReplyToMode } from "../config/types.base.js";

/**
 * Reply threading policy for controlling implicit reply-to-current behavior.
 * Used by channels to override default threading behavior for specific turns.
 */
export type ReplyThreadingPolicy = {
  /** Override implicit reply-to-current behavior for the current turn. */
  implicitCurrentMessage?: "default" | "allow" | "deny";
};

/**
 * Resolve batched reply threading policy from reply mode and batched flag.
 * Returns policy for "batched" mode, undefined otherwise.
 *
 * @param mode - The configured reply-to mode
 * @param isBatched - Whether this turn is part of a batch
 * @returns Threading policy or undefined if mode is not "batched"
 */
export function resolveBatchedReplyThreadingPolicy(
  mode: ReplyToMode,
  isBatched: boolean,
): ReplyThreadingPolicy | undefined {
  if (mode !== "batched") {
    return undefined;
  }
  return {
    implicitCurrentMessage: isBatched ? "allow" : "deny",
  };
}

export { createReplyReferencePlanner } from "../auto-reply/reply/reply-reference.js";
