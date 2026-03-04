/**
 * src/tools/process.ts
 * Background process manager tool
 */

import { spawn, type ChildProcess } from 'node:child_process';
import type { ToolHandler } from './types.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:process');

interface ManagedProcess {
    id: string;
    command: string;
    pid: number;
    startedAt: number;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    proc: ChildProcess;
}

const processes: Map<string, ManagedProcess> = new Map();
let nextId = 1;

export const processTool: ToolHandler = {
    name: 'process',
    description: 'Manage background processes — start, list, read output, write input, kill.',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['list', 'poll', 'write', 'kill', 'clear'],
                description: 'Action to perform',
            },
            id: { type: 'string', description: 'Process ID (for poll/write/kill)' },
            input: { type: 'string', description: 'Text to write to stdin (for write action)' },
        },
        required: ['action'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { action, id, input } = args;

        switch (action) {
            case 'list': {
                if (processes.size === 0) return 'No background processes';
                return Array.from(processes.values())
                    .map((p) => {
                        const status = p.exitCode !== null ? `exited(${p.exitCode})` : 'running';
                        const uptime = Math.round((Date.now() - p.startedAt) / 1000);
                        return `[${p.id}] PID ${p.pid} ${status} (${uptime}s) — ${p.command}`;
                    })
                    .join('\n');
            }

            case 'poll': {
                if (!id) return 'Error: id required';
                const proc = processes.get(id);
                if (!proc) return `Process ${id} not found`;

                const output = proc.stdout.slice(-5000);
                const errors = proc.stderr.slice(-2000);
                const status = proc.exitCode !== null ? `exited(${proc.exitCode})` : 'running';

                let result = `[${proc.id}] ${status}\n`;
                if (output) result += `stdout:\n${output}\n`;
                if (errors) result += `stderr:\n${errors}\n`;
                if (!output && !errors) result += '(no output yet)';

                // Clear after reading
                proc.stdout = '';
                proc.stderr = '';

                return result;
            }

            case 'write': {
                if (!id || !input) return 'Error: id and input required';
                const proc = processes.get(id);
                if (!proc) return `Process ${id} not found`;
                if (proc.exitCode !== null) return `Process ${id} already exited`;
                proc.proc.stdin?.write(input + '\n');
                return `Wrote to process ${id}`;
            }

            case 'kill': {
                if (!id) return 'Error: id required';
                const proc = processes.get(id);
                if (!proc) return `Process ${id} not found`;
                proc.proc.kill('SIGTERM');
                setTimeout(() => proc.proc.kill('SIGKILL'), 5000);
                return `Killed process ${id}`;
            }

            case 'clear': {
                const exited = Array.from(processes.entries())
                    .filter(([, p]) => p.exitCode !== null);
                for (const [key] of exited) processes.delete(key);
                return `Cleared ${exited.length} finished processes`;
            }

            default:
                return `Unknown action: ${action}`;
        }
    },
};

/**
 * Start a background process (called from exec tool when background=true)
 */
export function startBackgroundProcess(command: string, cwd?: string): string {
    const id = `proc_${nextId++}`;
    const proc = spawn('sh', ['-c', command], {
        cwd: cwd || process.env.HOME,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'dumb' },
    });

    const managed: ManagedProcess = {
        id,
        command,
        pid: proc.pid || 0,
        startedAt: Date.now(),
        stdout: '',
        stderr: '',
        exitCode: null,
        proc,
    };

    proc.stdout?.on('data', (data) => {
        managed.stdout += data.toString();
        // Cap buffer at 100KB
        if (managed.stdout.length > 100_000) {
            managed.stdout = managed.stdout.slice(-50_000);
        }
    });

    proc.stderr?.on('data', (data) => {
        managed.stderr += data.toString();
        if (managed.stderr.length > 50_000) {
            managed.stderr = managed.stderr.slice(-25_000);
        }
    });

    proc.on('exit', (code) => {
        managed.exitCode = code;
        log.info({ id, code }, 'Background process exited');
    });

    processes.set(id, managed);
    log.info({ id, pid: proc.pid, command }, 'Background process started');

    return id;
}
