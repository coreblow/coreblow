import type { InboundMessage } from '../types.js';
import type { GetReplyOptions } from '../types.js';
import type { QueueItem } from '../queue.types.js';
import { queues } from './queue.data.js';
export function enqueue(sessionKey: string, message: InboundMessage, options?: GetReplyOptions, priority?: number): QueueItem {
    let queue = queues.get(sessionKey);
    if (!queue) { queue = []; queues.set(sessionKey, queue); }
    const item: QueueItem = { id: crypto.randomUUID(), message, options, enqueuedAt: Date.now(), priority: priority ?? 0 };
    queue.push(item);
    queue.sort((a, b) => b.priority - a.priority);
    return item;
}
