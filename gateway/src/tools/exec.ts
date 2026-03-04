/**
 * src/tools/exec.ts
 * Execute shell commands tool
 */

import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { ToolHandler } from './types.js';

const execAsync = promisify(execCb);

export const execTool: ToolHandler = {
    name: 'exec',
    description: 'Execute a shell command and return the output. Use for running scripts, checking system info, file operations, etc.',
    parameters: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute',
            },
            cwd: {
                type: 'string',
                description: 'Working directory (optional, defaults to workspace)',
            },
            timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (optional, default 30000)',
            },
        },
        required: ['command'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { command, cwd, timeout = 30000 } = args;

        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: cwd || process.env.HOME,
                timeout,
                maxBuffer: 1024 * 1024, // 1MB
                env: { ...process.env, TERM: 'dumb' },
            });

            let output = '';
            if (stdout) output += stdout;
            if (stderr) output += (output ? '\n--- stderr ---\n' : '') + stderr;

            // Truncate if too long
            if (output.length > 10000) {
                output = output.slice(0, 10000) + '\n... (output truncated)';
            }

            return output || '(no output)';
        } catch (err: any) {
            if (err.killed) {
                return `Error: Command timed out after ${timeout}ms`;
            }
            return `Error (exit ${err.code || 'unknown'}): ${err.stderr || err.message}`;
        }
    },
};
