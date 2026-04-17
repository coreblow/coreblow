/**
 * src/agents/subagent.ts
 * Sub-agent System — spawn child agents for task delegation
 * SUPERIOR: CoreBlow has basic spawning; CoreBlow adds lifecycle, budget, result aggregation, chains
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('agents:subagent');

// ─── Types ────────────────────────────────────────────────────────

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface SubagentTask {
    id: string;
    parentId: string | null;
    name: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    /** Max tokens for response */
    maxTokens?: number;
    /** Timeout (ms) */
    timeoutMs: number;
    /** Max retries on failure */
    maxRetries: number;
    /** Current retry count */
    retryCount: number;
    status: SubagentStatus;
    result?: string;
    error?: string;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    metadata: Record<string, unknown>;
}

export interface SpawnOptions {
    name: string;
    prompt: string;
    systemPrompt?: string;
    provider?: string;
    model?: string;
    maxTokens?: number;
    timeoutMs?: number;
    maxRetries?: number;
    metadata?: Record<string, unknown>;
}

export interface SubagentConfig {
    /** Max concurrent sub-agents */
    maxConcurrent: number;
    /** Max depth (sub-agent spawning sub-agents) */
    maxDepth: number;
    /** Default timeout (ms) */
    defaultTimeoutMs: number;
    /** Max retries */
    defaultMaxRetries: number;
    /** Total token budget across all sub-agents */
    tokenBudget: number;
}

export interface DelegationResult {
    taskId: string;
    name: string;
    status: SubagentStatus;
    result?: string;
    error?: string;
    durationMs: number;
    retries: number;
}

const DEFAULT_CONFIG: SubagentConfig = {
    maxConcurrent: 5,
    maxDepth: 3,
    defaultTimeoutMs: 60_000,
    defaultMaxRetries: 2,
    tokenBudget: 100_000,
};

// ─── Sub-agent Manager ───────────────────────────────────────────

export class SubagentManager {
    private tasks = new Map<string, SubagentTask>();
    private config: SubagentConfig;
    private activeCount = 0;
    private tokenUsed = 0;
    private depthMap = new Map<string, number>(); // taskId → depth
    private executor: ((task: SubagentTask) => Promise<string>) | null = null;

    constructor(config?: Partial<SubagentConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Set the executor function (called to actually run the sub-agent)
     * This is the bridge to the AI provider
     */
    setExecutor(fn: (task: SubagentTask) => Promise<string>): void {
        this.executor = fn;
    }

    /**
     * Spawn a new sub-agent
     */
    spawn(parentId: string | null, opts: SpawnOptions): SubagentTask {
        // Check depth
        const parentDepth = parentId ? (this.depthMap.get(parentId) || 0) : 0;
        if (parentDepth >= this.config.maxDepth) {
            throw new Error(`Max sub-agent depth reached (${this.config.maxDepth})`);
        }

        // Check concurrency
        if (this.activeCount >= this.config.maxConcurrent) {
            throw new Error(`Max concurrent sub-agents reached (${this.config.maxConcurrent})`);
        }

        const task: SubagentTask = {
            id: randomUUID(),
            parentId,
            name: opts.name,
            prompt: opts.prompt,
            systemPrompt: opts.systemPrompt,
            provider: opts.provider,
            model: opts.model,
            maxTokens: opts.maxTokens,
            timeoutMs: opts.timeoutMs || this.config.defaultTimeoutMs,
            maxRetries: opts.maxRetries ?? this.config.defaultMaxRetries,
            retryCount: 0,
            status: 'pending',
            createdAt: Date.now(),
            metadata: opts.metadata || {},
        };

        this.tasks.set(task.id, task);
        this.depthMap.set(task.id, parentDepth + 1);

        log.info({ taskId: task.id, name: task.name, depth: parentDepth + 1 }, 'Sub-agent spawned');
        return task;
    }

    /**
     * Execute a spawned sub-agent task
     */
    async execute(taskId: string): Promise<DelegationResult> {
        const task = this.tasks.get(taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);
        if (!this.executor) throw new Error('No executor set. Call setExecutor() first.');

        task.status = 'running';
        task.startedAt = Date.now();
        this.activeCount++;

        try {
            // Timeout wrapper
            const result = await Promise.race([
                this.executor(task),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), task.timeoutMs)
                ),
            ]);

            task.status = 'completed';
            task.result = result;
            task.completedAt = Date.now();

            log.info({ taskId: task.id, name: task.name, durationMs: task.completedAt - task.startedAt! }, 'Sub-agent completed');

            return this.toDelegationResult(task);
        } catch (err: unknown) {
            task.retryCount++;

            if ((err instanceof Error ? err.message : String(err)) === 'Timeout') {
                task.status = 'timeout';
                task.error = 'Execution timed out';
            } else if (task.retryCount < task.maxRetries) {
                // Retry
                task.status = 'pending';
                this.activeCount--;
                log.warn({ taskId: task.id, retry: task.retryCount, error: (err instanceof Error ? err.message : String(err)) }, 'Retrying sub-agent');
                return this.execute(taskId);
            } else {
                task.status = 'failed';
                task.error = (err instanceof Error ? err.message : String(err));
            }

            task.completedAt = Date.now();
            log.error({ taskId: task.id, error: task.error }, 'Sub-agent failed');
            return this.toDelegationResult(task);
        } finally {
            this.activeCount--;
        }
    }

    /**
     * Spawn and execute in one call
     */
    async delegate(parentId: string | null, opts: SpawnOptions): Promise<DelegationResult> {
        const task = this.spawn(parentId, opts);
        return this.execute(task.id);
    }

    /**
     * Fan-out: delegate to multiple sub-agents in parallel
     */
    async fanOut(parentId: string | null, tasks: SpawnOptions[]): Promise<DelegationResult[]> {
        const spawned = tasks.map(t => this.spawn(parentId, t));
        return Promise.all(spawned.map(t => this.execute(t.id)));
    }

    /**
     * Chain: execute sub-agents sequentially, passing result to next
     */
    async chain(parentId: string | null, steps: SpawnOptions[]): Promise<DelegationResult[]> {
        const results: DelegationResult[] = [];
        let previousResult = '';

        for (const step of steps) {
            const prompt = previousResult
                ? `${step.prompt}\n\nPrevious step result:\n${previousResult}`
                : step.prompt;

            const result = await this.delegate(parentId, { ...step, prompt });
            results.push(result);

            if (result.status === 'completed' && result.result) {
                previousResult = result.result;
            } else {
                // Chain broken — stop
                log.warn({ step: step.name, status: result.status }, 'Chain broken');
                break;
            }
        }

        return results;
    }

    /**
     * Cancel a running task
     */
    cancel(taskId: string): boolean {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'running') return false;
        task.status = 'cancelled';
        task.completedAt = Date.now();
        return true;
    }

    /**
     * Get task by ID
     */
    getTask(taskId: string): SubagentTask | undefined {
        return this.tasks.get(taskId);
    }

    /**
     * Get all child tasks of a parent
     */
    getChildren(parentId: string): SubagentTask[] {
        return Array.from(this.tasks.values()).filter(t => t.parentId === parentId);
    }

    /**
     * Get full task tree from a root
     */
    getTree(rootId: string): { task: SubagentTask; children: unknown[] } | null {
        const task = this.tasks.get(rootId);
        if (!task) return null;

        const children = this.getChildren(rootId).map(c => this.getTree(c.id));
        return { task, children: children.filter(Boolean) };
    }

    /**
     * Build context string from completed sub-agent results
     */
    buildContext(taskIds: string[]): string {
        const parts: string[] = ['[Sub-agent Results]'];
        for (const id of taskIds) {
            const task = this.tasks.get(id);
            if (!task) continue;
            if (task.status === 'completed' && task.result) {
                parts.push(`\n### ${task.name}\n${task.result}`);
            } else {
                parts.push(`\n### ${task.name}\n(${task.status}: ${task.error || 'no result'})`);
            }
        }
        return parts.join('\n');
    }

    /**
     * Get stats
     */
    getStats() {
        const tasks = Array.from(this.tasks.values());
        return {
            total: tasks.length,
            active: this.activeCount,
            pending: tasks.filter(t => t.status === 'pending').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            cancelled: tasks.filter(t => t.status === 'cancelled').length,
            timeout: tasks.filter(t => t.status === 'timeout').length,
            tokenBudgetUsed: this.tokenUsed,
            tokenBudgetRemaining: this.config.tokenBudget - this.tokenUsed,
        };
    }

    /**
     * Clean up completed/failed tasks older than maxAge
     */
    cleanup(maxAgeMs: number = 30 * 60 * 1000): number {
        const cutoff = Date.now() - maxAgeMs;
        let removed = 0;
        for (const [id, task] of this.tasks) {
            if (task.completedAt && task.completedAt < cutoff) {
                this.tasks.delete(id);
                this.depthMap.delete(id);
                removed++;
            }
        }
        return removed;
    }

    // ─── Private ─────────────────────────────────────────────────

    private toDelegationResult(task: SubagentTask): DelegationResult {
        return {
            taskId: task.id,
            name: task.name,
            status: task.status,
            result: task.result,
            error: task.error,
            durationMs: (task.completedAt || Date.now()) - (task.startedAt || task.createdAt),
            retries: task.retryCount,
        };
    }
}
