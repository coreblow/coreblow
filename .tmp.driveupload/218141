import type { QueueItem } from '../queue.types.js';
import type { QueuePolicy } from '../queue.types.js';
import { queues } from './queue.data.js';
export function dequeue(sessionKey: string, policy?: QueuePolicy): QueueItem | undefined {
    const queue = queues.get(sessionKey);
    if (!queue || queue.length === 0) return undefined;
    if (policy === 'latest') { const item = queue.pop(); queues.set(sessionKey, []); return item; }
    return queue.shift();
}
