/** CoreBlow — Delivery Queue */
import { enqueue, dequeue, getQueueSize, type QueuedItem } from "./delivery-queue-storage.js";
export { type QueuedItem } from "./delivery-queue-storage.js";
export class DeliveryQueue {
  enqueue(channelId: string, payload: unknown): string { return enqueue({ channelId, payload }); }
  dequeue(): QueuedItem | undefined { return dequeue(); }
  get size(): number { return getQueueSize(); }
}
