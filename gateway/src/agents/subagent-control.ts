/**
 * CoreBlow Subagent Control Engine
 *
 * Manages subagent lifecycle: spawn, communicate, monitor, and terminate.
 * Supports parallel execution, result aggregation, resource budgeting,
 * and fault isolation.
 *
 * Equivalent: CoreBlow src/agents/subagent-control.ts (995 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

const log = createChildLogger('subagent-control');

// ─── Types ────────────────────────────────────────────────────────

export type SubagentStatus =
    | 'idle'
    | 'starting'
    | 'running'
    | 'waiting'
    | 'complete'
    | 'error'
    | 'timeout'
    | 'cancelled';

export interface SubagentConfig {
    id: string;
    name: string;
    parentSessionId: string;
    model?: string;
    systemPrompt?: string;
    tools?: string[];
    maxTurns?: number;
    maxTokens?: number;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
}

export interface SubagentInstance {
    config: SubagentConfig;
    status: SubagentStatus;
    startedAt?: number;
    completedAt?: number;
    turns: number;
    tokensUsed: number;
    messages: SubagentMessage[];
    result?: SubagentResult;
    error?: string;
}

export interface SubagentMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: Array<{ id: string; name: string; arguments: string }>;
    toolCallId?: string;
}

export interface SubagentResult {
    success: boolean;
    output: string;
    summary?: string;
    artifacts?: Array<{ name: string; content: string; type: string }>;
    tokensUsed: number;
    turns: number;
    durationMs: number;
}

export interface SubagentGroupResult {
    all: SubagentResult[];
    successful: SubagentResult[];
    failed: Array<{ id: string; error: string }>;
    totalTokensUsed: number;
    totalDurationMs: number;
}

export interface ResourceBudget {
    maxConcurrent: number;
    maxTotalTokens: number;
    maxDurationMs: number;
    tokensUsed: number;
    startedAt: number;
}

// ─── Subagent Registry ────────────────────────────────────────────

const instances = new Map<string, SubagentInstance>();
const budgets = new Map<string, ResourceBudget>();

/**
 * Spawn a new subagent
 */
export function spawnSubagent(config: SubagentConfig): SubagentInstance {
    if (instances.has(config.id)) {
        throw new Error(`Subagent with id "${config.id}" already exists`);
    }

    const instance: SubagentInstance = {
        config: {
            ...config,
            maxTurns: config.maxTurns ?? 10,
            maxTokens: config.maxTokens ?? 50_000,
            timeoutMs: config.timeoutMs ?? 120_000,
        },
        status: 'starting',
        startedAt: Date.now(),
        turns: 0,
        tokensUsed: 0,
        messages: [],
    };

    instances.set(config.id, instance);
    log.info({ id: config.id, name: config.name, parentSession: config.parentSessionId }, 'Subagent spawned');
    return instance;
}

/**
 * Get a subagent instance
 */
export function getSubagent(id: string): SubagentInstance | undefined {
    return instances.get(id);
}

/**
 * List all subagents for a session
 */
export function listSubagents(parentSessionId?: string): SubagentInstance[] {
    const all = Array.from(instances.values());
    return parentSessionId
        ? all.filter((s) => s.config.parentSessionId === parentSessionId)
        : all;
}

/**
 * Send a message to a subagent
 */
export function sendMessage(id: string, message: SubagentMessage): boolean {
    const instance = instances.get(id);
    if (!instance) {
        log.error({ id }, 'Subagent not found');
        return false;
    }

    if (instance.status !== 'running' && instance.status !== 'starting' && instance.status !== 'waiting') {
        log.warn({ id, status: instance.status }, 'Cannot send message to non-active subagent');
        return false;
    }

    instance.messages.push(message);
    if (message.role === 'user') {
        instance.turns++;
        instance.status = 'running';
    }

    // Check turn limit
    if (instance.config.maxTurns && instance.turns >= instance.config.maxTurns) {
        completeSubagent(id, {
            success: true,
            output: 'Max turns reached',
            tokensUsed: instance.tokensUsed,
            turns: instance.turns,
            durationMs: Date.now() - (instance.startedAt ?? Date.now()),
        });
    }

    return true;
}

/**
 * Mark a subagent as complete with result
 */
export function completeSubagent(id: string, result: SubagentResult): void {
    const instance = instances.get(id);
    if (!instance) return;

    instance.status = 'complete';
    instance.completedAt = Date.now();
    instance.result = result;

    // Update budget
    const budget = budgets.get(instance.config.parentSessionId);
    if (budget) {
        budget.tokensUsed += result.tokensUsed;
    }

    log.info({
        id,
        turns: result.turns,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
    }, 'Subagent completed');
}

/**
 * Mark a subagent as failed
 */
export function failSubagent(id: string, error: string): void {
    const instance = instances.get(id);
    if (!instance) return;

    instance.status = 'error';
    instance.completedAt = Date.now();
    instance.error = error;
    log.error({ id, error }, 'Subagent failed');
}

/**
 * Cancel a subagent
 */
export function cancelSubagent(id: string, reason?: string): boolean {
    const instance = instances.get(id);
    if (!instance) return false;
    if (instance.status === 'complete' || instance.status === 'error') return false;

    instance.status = 'cancelled';
    instance.completedAt = Date.now();
    instance.error = reason ?? 'Cancelled by parent';
    log.info({ id, reason }, 'Subagent cancelled');
    return true;
}

/**
 * Remove a subagent from registry
 */
export function removeSubagent(id: string): boolean {
    return instances.delete(id);
}

/**
 * Clear all subagents for a session
 */
export function clearSessionSubagents(parentSessionId: string): number {
    let cleared = 0;
    for (const [id, instance] of instances) {
        if (instance.config.parentSessionId === parentSessionId) {
            instances.delete(id);
            cleared++;
        }
    }
    return cleared;
}

/**
 * Clear all subagents
 */
export function clearAllSubagents(): void {
    instances.clear();
    budgets.clear();
}

// ─── Parallel Execution ───────────────────────────────────────────

/**
 * Spawn multiple subagents and run them in parallel
 */
export async function spawnParallel(
    configs: SubagentConfig[],
    executor: (instance: SubagentInstance) => Promise<SubagentResult>,
    options?: { maxConcurrent?: number },
): Promise<SubagentGroupResult> {
    const maxConcurrent = options?.maxConcurrent ?? 3;
    const start = Date.now();
    const results: SubagentResult[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    // Spawn all instances
    const spawnedInstances = configs.map((config) => spawnSubagent(config));

    // Execute with concurrency limit
    const queue = [...spawnedInstances];
    const running = new Set<Promise<void>>();

    while (queue.length > 0 || running.size > 0) {
        while (queue.length > 0 && running.size < maxConcurrent) {
            const instance = queue.shift()!;
            const promise = (async () => {
                try {
                    instance.status = 'running';
                    const result = await Promise.race([
                        executor(instance),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Subagent timeout')), instance.config.timeoutMs),
                        ),
                    ]);
                    completeSubagent(instance.config.id, result);
                    results.push(result);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    failSubagent(instance.config.id, message);
                    failed.push({ id: instance.config.id, error: message });
                }
            })();

            running.add(promise);
            promise.then(() => running.delete(promise));
        }

        if (running.size > 0) {
            await Promise.race(running);
        }
    }

    return {
        all: results,
        successful: results.filter((r) => r.success),
        failed,
        totalTokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
        totalDurationMs: Date.now() - start,
    };
}

/**
 * Spawn a sequential chain of subagents (output of one feeds into next)
 */
export async function spawnChain(
    configs: SubagentConfig[],
    executor: (instance: SubagentInstance, previousResult?: SubagentResult) => Promise<SubagentResult>,
): Promise<SubagentGroupResult> {
    const start = Date.now();
    const results: SubagentResult[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    let previousResult: SubagentResult | undefined;

    for (const config of configs) {
        const instance = spawnSubagent(config);
        try {
            instance.status = 'running';
            const result = await Promise.race([
                executor(instance, previousResult),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Subagent timeout')), instance.config.timeoutMs),
                ),
            ]);
            completeSubagent(instance.config.id, result);
            results.push(result);
            previousResult = result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failSubagent(instance.config.id, message);
            failed.push({ id: instance.config.id, error: message });
            break; // Stop chain on failure
        }
    }

    return {
        all: results,
        successful: results.filter((r) => r.success),
        failed,
        totalTokensUsed: results.reduce((sum, r) => sum + r.tokensUsed, 0),
        totalDurationMs: Date.now() - start,
    };
}

// ─── Resource Budgeting ───────────────────────────────────────────

/**
 * Create a resource budget for a session's subagents
 */
export function createBudget(
    sessionId: string,
    options?: { maxConcurrent?: number; maxTotalTokens?: number; maxDurationMs?: number },
): ResourceBudget {
    const budget: ResourceBudget = {
        maxConcurrent: options?.maxConcurrent ?? 5,
        maxTotalTokens: options?.maxTotalTokens ?? 200_000,
        maxDurationMs: options?.maxDurationMs ?? 600_000,
        tokensUsed: 0,
        startedAt: Date.now(),
    };

    budgets.set(sessionId, budget);
    return budget;
}

/**
 * Check if budget allows spawning more subagents
 */
export function canSpawnWithinBudget(sessionId: string): {
    allowed: boolean;
    reason?: string;
} {
    const budget = budgets.get(sessionId);
    if (!budget) return { allowed: true };

    const activeCount = listSubagents(sessionId)
        .filter((s) => s.status === 'running' || s.status === 'starting').length;

    if (activeCount >= budget.maxConcurrent) {
        return { allowed: false, reason: `Max concurrent limit reached (${budget.maxConcurrent})` };
    }

    if (budget.tokensUsed >= budget.maxTotalTokens) {
        return { allowed: false, reason: `Token budget exhausted (${budget.tokensUsed}/${budget.maxTotalTokens})` };
    }

    if (Date.now() - budget.startedAt > budget.maxDurationMs) {
        return { allowed: false, reason: 'Duration budget exceeded' };
    }

    return { allowed: true };
}

/**
 * Get budget status
 */
export function getBudgetStatus(sessionId: string): ResourceBudget | undefined {
    return budgets.get(sessionId);
}

// ─── Monitoring ───────────────────────────────────────────────────

/**
 * Check for timed-out subagents
 */
export function checkTimeouts(): SubagentInstance[] {
    const timedOut: SubagentInstance[] = [];
    const now = Date.now();

    for (const instance of instances.values()) {
        if (instance.status !== 'running' && instance.status !== 'starting') continue;
        if (!instance.startedAt || !instance.config.timeoutMs) continue;

        if (now - instance.startedAt > instance.config.timeoutMs) {
            instance.status = 'timeout';
            instance.completedAt = now;
            instance.error = `Timeout after ${instance.config.timeoutMs}ms`;
            timedOut.push(instance);
            log.warn({ id: instance.config.id, timeoutMs: instance.config.timeoutMs }, 'Subagent timed out');
        }
    }

    return timedOut;
}

/**
 * Get summary stats for monitoring
 */
export function getSubagentStats(parentSessionId?: string): {
    total: number;
    byStatus: Record<SubagentStatus, number>;
    totalTokensUsed: number;
    avgDurationMs: number;
} {
    const agents = parentSessionId ? listSubagents(parentSessionId) : Array.from(instances.values());

    const byStatus: Record<SubagentStatus, number> = {
        idle: 0, starting: 0, running: 0, waiting: 0,
        complete: 0, error: 0, timeout: 0, cancelled: 0,
    };

    let totalTokens = 0;
    let totalDuration = 0;
    let completedCount = 0;

    for (const agent of agents) {
        byStatus[agent.status]++;
        totalTokens += agent.tokensUsed;
        if (agent.completedAt && agent.startedAt) {
            totalDuration += agent.completedAt - agent.startedAt;
            completedCount++;
        }
    }

    return {
        total: agents.length,
        byStatus,
        totalTokensUsed: totalTokens,
        avgDurationMs: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0,
    };
}

// ─── Subagent Event Bus ───────────────────────────────────────────

export const subagentBus = new EventEmitter();

/**
 * Emit a subagent event
 */
export function emitSubagentEvent(event: string, data: Record<string, unknown>): void {
    subagentBus.emit(event, data);
}

/**
 * Listen for subagent events
 */
export function onSubagentEvent(event: string, handler: (data: Record<string, unknown>) => void): void {
    subagentBus.on(event, handler);
}
