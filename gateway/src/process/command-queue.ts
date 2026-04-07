/**
 * process/command-queue.ts — Sequential command execution queue.
 */

export type QueuePriority = 'low' | 'normal' | 'high' | 'critical';
export interface QueuedCommand { id: string; command: string; priority: QueuePriority; addedAt: number; startedAt?: number; completedAt?: number; output?: string; error?: string; status: 'pending' | 'running' | 'completed' | 'failed' }

const PRIORITY_ORDER: Record<QueuePriority, number> = { critical: 4, high: 3, normal: 2, low: 1 };
const queue: QueuedCommand[] = [];
let maxConcurrent = 3;

export function enqueueCommand(id: string, command: string, priority: QueuePriority = 'normal'): QueuedCommand {
    const cmd: QueuedCommand = { id, command, priority, addedAt: Date.now(), status: 'pending' };
    queue.push(cmd);
    queue.sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]);
    return cmd;
}

export function getNextCommand(): QueuedCommand | null {
    const running = queue.filter(c => c.status === 'running').length;
    if (running >= maxConcurrent) return null;
    return queue.find(c => c.status === 'pending') ?? null;
}

export function startCommand(id: string): boolean { const c = queue.find(q => q.id === id); if (!c) return false; c.status = 'running'; c.startedAt = Date.now(); return true; }
export function completeCommand(id: string, output: string): boolean { const c = queue.find(q => q.id === id); if (!c) return false; c.status = 'completed'; c.completedAt = Date.now(); c.output = output; return true; }
export function failCommand(id: string, error: string): boolean { const c = queue.find(q => q.id === id); if (!c) return false; c.status = 'failed'; c.completedAt = Date.now(); c.error = error; return true; }
export function getQueueStatus(): { pending: number; running: number; completed: number; failed: number } {
    return { pending: queue.filter(c => c.status === 'pending').length, running: queue.filter(c => c.status === 'running').length, completed: queue.filter(c => c.status === 'completed').length, failed: queue.filter(c => c.status === 'failed').length };
}
export function setMaxConcurrent(n: number): void { maxConcurrent = n; }
export function clearQueue(): void { queue.length = 0; }
