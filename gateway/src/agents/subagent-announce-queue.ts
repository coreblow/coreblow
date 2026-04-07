/** Subagent announcement queue. */
const queue: Array<{ agentId: string; message: string; timestamp: number }> = [];
export function enqueueAnnouncement(agentId: string, message: string): void { queue.push({ agentId, message, timestamp: Date.now() }); }
export function drainQueue(): typeof queue { const items = [...queue]; queue.length = 0; return items; }
export function queueSize(): number { return queue.length; }
