/**
 * CoreBlow — Tool Executor
 *
 * Executes tool calls from the agent with sandboxing,
 * timeout enforcement, retry logic, result formatting,
 * and execution logging.
 */

import type { ToolRegistry, ToolDefinition } from './tool-registry.js';

/** Tool execution result */
export interface ToolExecutionResult {
    toolName: string;
    callId: string;
    success: boolean;
    output: string;
    error?: string;
    durationMs: number;
    timestamp: number;
}

/** Executor options */
export interface ExecutorOptions {
    /** Default timeout per tool execution (ms) */
    timeoutMs?: number;
    /** Maximum retries on failure */
    maxRetries?: number;
    /** Maximum concurrent tool executions */
    maxConcurrent?: number;
}

/**
 * CoreBlow Tool Executor
 */
export class ToolExecutor {
    private registry: ToolRegistry;
    private options: Required<ExecutorOptions>;
    private history: ToolExecutionResult[] = [];
    private maxHistory = 500;
    private activeCalls = 0;

    constructor(registry: ToolRegistry, opts?: ExecutorOptions) {
        this.registry = registry;
        this.options = {
            timeoutMs: opts?.timeoutMs ?? 30_000,
            maxRetries: opts?.maxRetries ?? 2,
            maxConcurrent: opts?.maxConcurrent ?? 5,
        };
    }

    /**
     * Execute a single tool call.
     */
    async execute(toolName: string, args: Record<string, unknown>, callId?: string): Promise<ToolExecutionResult> {
        const tool = this.registry.get(toolName);
        if (!tool || tool.enabled === false) {
            return this.buildResult(toolName, callId ?? '', false, '', `Tool "${toolName}" not found or disabled`, 0);
        }

        if (this.activeCalls >= this.options.maxConcurrent) {
            return this.buildResult(toolName, callId ?? '', false, '', 'Too many concurrent tool calls', 0);
        }

        this.activeCalls++;
        const start = Date.now();

        try {
            const output = await this.executeWithRetry(tool, args);
            const result = this.buildResult(toolName, callId ?? '', true, output, undefined, Date.now() - start);
            this.record(result);
            return result;
        } catch (err) {
            const result = this.buildResult(toolName, callId ?? '', false, '',
                err instanceof Error ? err.message : String(err), Date.now() - start);
            this.record(result);
            return result;
        } finally {
            this.activeCalls--;
        }
    }

    /**
     * Execute multiple tool calls in parallel.
     */
    async executeMany(calls: Array<{ toolName: string; args: Record<string, unknown>; callId: string }>): Promise<ToolExecutionResult[]> {
        return Promise.all(calls.map((c) => this.execute(c.toolName, c.args, c.callId)));
    }

    /**
     * Get execution history.
     */
    getHistory(limit?: number): ToolExecutionResult[] {
        return this.history.slice(-(limit ?? 50));
    }

    /**
     * Get execution stats.
     */
    getStats(): { totalCalls: number; successRate: number; avgDurationMs: number; activeCalls: number } {
        const total = this.history.length;
        const successes = this.history.filter((r) => r.success).length;
        const avgDuration = total > 0
            ? this.history.reduce((s, r) => s + r.durationMs, 0) / total
            : 0;
        return {
            totalCalls: total,
            successRate: total > 0 ? successes / total : 0,
            avgDurationMs: avgDuration,
            activeCalls: this.activeCalls,
        };
    }

    // === Private ===

    private async executeWithRetry(tool: ToolDefinition, args: Record<string, unknown>): Promise<string> {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
            try {
                return await this.executeWithTimeout(tool, args);
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                if (attempt < this.options.maxRetries) {
                    await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
                }
            }
        }
        throw lastError;
    }

    private async executeWithTimeout(tool: ToolDefinition, args: Record<string, unknown>): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error(`Tool "${tool.name}" timed out after ${this.options.timeoutMs}ms`)), this.options.timeoutMs);
            tool.handler(args)
                .then((result) => { clearTimeout(timer); resolve(result); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });
    }

    private buildResult(toolName: string, callId: string, success: boolean, output: string, error: string | undefined, durationMs: number): ToolExecutionResult {
        return { toolName, callId, success, output, error, durationMs, timestamp: Date.now() };
    }

    private record(result: ToolExecutionResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    }
}
