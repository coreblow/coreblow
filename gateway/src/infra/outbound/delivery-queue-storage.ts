/** CoreBlow — Delivery Queue Storage */
export interface QueuedItem { id: string; payload: unknown; channelId: string; enqueuedAt: number; attempts: number; }
const queue: QueuedItem[] = [];
export function enqueue(item: Omit<QueuedItem, "id" | "enqueuedAt" | "attempts">): string { const id = "qi-" + crypto.randomUUID().slice(0, 8); queue.push({ ...item, id, enqueuedAt: Date.now(), attempts: 0 }); return id; }
export function dequeue(): QueuedItem | undefined { return queue.shift(); }
export function getQueueSize(): number { return queue.length; }
export function clearQueue(): void { queue.length = 0; }
