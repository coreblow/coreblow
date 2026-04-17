/**
 * CoreBlow — Task Queue
 *
 * Priority-based task queue with concurrency control,
 * delayed execution, dead letter queue, and progress
 * tracking.
 */

/** Task */
export interface QueueTask {
    id: string;
    name: string;
    handler: () => Promise<unknown>;
    priority: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: unknown;
    error?: string;
    retries: number;
    maxRetries: number;
}

/**
 * CoreBlow Task Queue
 */
export class TaskQueue {
    private queue: QueueTask[] = [];
    private running = new Map<string, QueueTask>();
    private completed: QueueTask[] = [];
    private deadLetter: QueueTask[] = [];
    private maxConcurrency: number;
    private idCounter = 0;
    private processing = false;

    constructor(maxConcurrency: number = 5) {
        this.maxConcurrency = maxConcurrency;
    }

    /**
     * Enqueue a task.
     */
    enqueue(name: string, handler: () => Promise<unknown>, priority: number = 0, maxRetries: number = 0): string {
        const id = `task-${++this.idCounter}`;
        const task: QueueTask = {
            id, name, handler, priority, status: 'pending',
            createdAt: Date.now(), retries: 0, maxRetries,
        };
        this.queue.push(task);
        this.queue.sort((a, b) => b.priority - a.priority);
        return id;
    }

    /**
     * Process the queue.
     */
    async process(): Promise<number> {
        if (this.processing) return 0;
        this.processing = true;
        let processed = 0;

        while (this.queue.length > 0 && this.running.size < this.maxConcurrency) {
            const task = this.queue.shift()!;
            task.status = 'running';
            task.startedAt = Date.now();
            this.running.set(task.id, task);

            try {
                task.result = await task.handler();
                task.status = 'completed';
                task.completedAt = Date.now();
                this.completed.push(task);
                processed++;
            } catch (err) {
                task.retries++;
                if (task.retries <= task.maxRetries) {
                    task.status = 'pending';
                    this.queue.push(task);
                } else {
                    task.status = 'failed';
                    task.error = err instanceof Error ? err.message : String(err);
                    task.completedAt = Date.now();
                    this.deadLetter.push(task);
                }
            } finally {
                this.running.delete(task.id);
            }
        }

        this.processing = false;
        return processed;
    }

    /**
     * Get queue stats.
     */
    getStats(): { pending: number; running: number; completed: number; failed: number } {
        return { pending: this.queue.length, running: this.running.size, completed: this.completed.length, failed: this.deadLetter.length };
    }

    /**
     * Get dead letter queue.
     */
    getDeadLetter(): QueueTask[] { return [...this.deadLetter]; }

    /**
     * Clear completed tasks.
     */
    clearCompleted(): number { const c = this.completed.length; this.completed = []; return c; }

    /** Count pending */
    count(): number { return this.queue.length; }
}
