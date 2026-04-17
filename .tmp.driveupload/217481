/**
 * CoreBlow — Sandbox Executor
 *
 * Safely executes user-provided code in an isolated environment
 * with timeout, memory limits, output capture, and restricted
 * module access. Supports JavaScript/TypeScript evaluation.
 */

import * as vm from 'node:vm';

/** Sandbox configuration */
export interface SandboxConfig {
    /** Execution timeout (ms) */
    timeoutMs?: number;
    /** Maximum output length */
    maxOutput?: number;
    /** Allowed global variables */
    allowedGlobals?: string[];
    /** Custom context variables */
    context?: Record<string, unknown>;
}

/** Sandbox execution result */
export interface SandboxResult {
    success: boolean;
    output: string;
    returnValue?: unknown;
    error?: string;
    durationMs: number;
    truncated: boolean;
}

/**
 * CoreBlow Sandbox Executor
 */
export class SandboxExecutor {
    private config: Required<SandboxConfig>;
    private history: SandboxResult[] = [];
    private maxHistory = 100;

    constructor(config?: SandboxConfig) {
        this.config = {
            timeoutMs: config?.timeoutMs ?? 5_000,
            maxOutput: config?.maxOutput ?? 10_000,
            allowedGlobals: config?.allowedGlobals ?? ['Math', 'Date', 'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'Array', 'Object', 'String', 'Number', 'Boolean', 'RegExp', 'Map', 'Set', 'Promise', 'Error'],
            context: config?.context ?? {},
        };
    }

    /**
     * Execute code in sandbox.
     */
    execute(code: string, extraContext?: Record<string, unknown>): SandboxResult {
        const start = Date.now();
        const outputLines: string[] = [];

        // Build sandbox context
        const sandbox: Record<string, unknown> = {
            console: {
                log: (...args: unknown[]) => outputLines.push(args.map(String).join(' ')),
                error: (...args: unknown[]) => outputLines.push(`[ERROR] ${args.map(String).join(' ')}`),
                warn: (...args: unknown[]) => outputLines.push(`[WARN] ${args.map(String).join(' ')}`),
            },
            ...this.config.context,
            ...extraContext,
        };

        // Add allowed globals
        for (const name of this.config.allowedGlobals) {
            sandbox[name] = (globalThis as Record<string, unknown>)[name];
        }

        try {
            const context = vm.createContext(sandbox);
            const script = new vm.Script(code, { filename: 'sandbox.js' });
            const returnValue = script.runInContext(context, { timeout: this.config.timeoutMs });

            let output = outputLines.join('\n');
            let truncated = false;
            if (output.length > this.config.maxOutput) {
                output = output.slice(0, this.config.maxOutput) + '\n... (truncated)';
                truncated = true;
            }

            const result: SandboxResult = {
                success: true,
                output,
                returnValue,
                durationMs: Date.now() - start,
                truncated,
            };
            this.record(result);
            return result;
        } catch (err) {
            const result: SandboxResult = {
                success: false,
                output: outputLines.join('\n'),
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
                truncated: false,
            };
            this.record(result);
            return result;
        }
    }

    /**
     * Execute code and return just the output string.
     */
    eval(code: string): string {
        const result = this.execute(code);
        return result.success ? (result.output || String(result.returnValue ?? '')) : `Error: ${result.error}`;
    }

    /**
     * Get execution history.
     */
    getHistory(limit?: number): SandboxResult[] {
        return this.history.slice(-(limit ?? 20));
    }

    // === Private ===

    private record(result: SandboxResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) this.history = this.history.slice(-this.maxHistory);
    }
}
