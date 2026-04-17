/**
 * CoreBlow — Safe Code Interpreter
 *
 * Executes code through vm.createContext sandbox instead of raw eval().
 * Provides timeout, output capture, and restricted global access.
 */

import { SandboxExecutor } from '../../sandbox/sandbox.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_OUTPUT = 50_000;

export class CodeInterpreter {
    private sandbox: SandboxExecutor;

    constructor(options?: { timeoutMs?: number; maxOutput?: number }) {
        this.sandbox = new SandboxExecutor({
            timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
            maxOutput: options?.maxOutput ?? DEFAULT_MAX_OUTPUT,
            allowedGlobals: [
                'Math', 'Date', 'JSON', 'parseInt', 'parseFloat',
                'isNaN', 'isFinite', 'Array', 'Object', 'String',
                'Number', 'Boolean', 'RegExp', 'Map', 'Set',
                'Promise', 'Error', 'Symbol', 'BigInt',
                'encodeURIComponent', 'decodeURIComponent',
                'encodeURI', 'decodeURI',
            ],
        });
    }

    async execute(
        code: string,
        _lang = 'javascript',
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const result = this.sandbox.execute(code);

        if (result.success) {
            const stdout = result.output
                ? result.output
                : result.returnValue !== undefined
                    ? String(result.returnValue)
                    : '';
            return { stdout, stderr: '', exitCode: 0 };
        }

        return {
            stdout: result.output || '',
            stderr: result.error ?? 'Unknown execution error',
            exitCode: 1,
        };
    }

    /**
     * Get execution history for debugging.
     */
    getHistory(limit?: number) {
        return this.sandbox.getHistory(limit);
    }
}
