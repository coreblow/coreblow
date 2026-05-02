export { extractQueueDirective } from "./queue/directive.js";
export { clearSessionQueues } from "./queue/cleanup.js";
export type { ClearSessionQueueResult } from "./queue/cleanup.js";
export { scheduleFollowupDrain } from "./queue/drain.js";
export {
  enqueueFollowupRun,
  getFollowupQueueDepth,
  resetRecentQueuedMessageIdDedupe,
} from "./queue/enqueue.js";
export { resolveQueueSettings } from "./queue/settings.js";
export { clearFollowupQueue, refreshQueuedFollowupSession } from "./queue/state.js";
export type {
  FollowupRun,
  QueueDedupeMode,
  QueueDropPolicy,
  QueueMode,
  QueueSettings,
} from "./queue/types.js";

// ─── Phase 8: ReplyQueue ────────────────────

import type { ReplyEnvelope } from "../types.js";

/**
 * Priority queue for reply envelopes with dedup and max size.
 * Higher priority dequeued first.
 */
export class ReplyQueue {
  private items: ReplyEnvelope[] = [];
  private seen = new Set<string>();
  private maxSize: number;

  constructor(maxSize = Infinity) {
    this.maxSize = maxSize;
  }

  get size(): number {
    return this.items.length;
  }

  /** Enqueue an envelope. Returns false if duplicate or at capacity. */
  enqueue(envelope: ReplyEnvelope): boolean {
    const key = envelope.inbound.id;
    if (this.seen.has(key)) return false;
    if (this.items.length >= this.maxSize) return false;
    this.seen.add(key);
    this.items.push(envelope);
    // Sort descending by priority (highest first)
    this.items.sort((a, b) => b.priority - a.priority);
    return true;
  }

  /** Dequeue highest-priority envelope, or undefined if empty. */
  dequeue(): ReplyEnvelope | undefined {
    const item = this.items.shift();
    if (item) this.seen.delete(item.inbound.id);
    return item;
  }
}
