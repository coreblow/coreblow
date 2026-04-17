/**
 * process/child-process-bridge.ts
 * stdio bridge for child processes.
 * Ported from OpenClaw src/process/child-process-bridge.ts.
 */

import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface BridgeMessage {
    type: string;
    data: unknown;
    timestamp: number;
}

/**
 * Child process bridge for structured IPC communication.
 */
export class ChildProcessBridge extends EventEmitter {
    private child: ChildProcess;
    private buffer = '';
    private alive = true;

    constructor(child: ChildProcess) {
        super();
        this.child = child;

        child.stdout?.on('data', (data: Buffer) => {
            this.buffer += data.toString();
            this.processBuffer();
        });

        child.stderr?.on('data', (data: Buffer) => {
            this.emit('stderr', data.toString());
        });

        child.on('close', (code) => {
            this.alive = false;
            this.emit('exit', code);
        });

        child.on('error', (err) => {
            this.alive = false;
            this.emit('error', err);
        });
    }

    /**
     * Send a structured message to the child process.
     */
    send(type: string, data: unknown): boolean {
        if (!this.alive || !this.child.stdin?.writable) return false;
        const msg: BridgeMessage = { type, data, timestamp: Date.now() };
        this.child.stdin.write(JSON.stringify(msg) + '\n');
        return true;
    }

    /**
     * Send raw text to stdin.
     */
    sendRaw(text: string): boolean {
        if (!this.alive || !this.child.stdin?.writable) return false;
        this.child.stdin.write(text);
        return true;
    }

    /**
     * Close the bridge (end stdin).
     */
    close(): void {
        if (this.child.stdin?.writable) this.child.stdin.end();
    }

    isAlive(): boolean { return this.alive; }
    getPid(): number | undefined { return this.child.pid; }

    private processBuffer(): void {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const msg = JSON.parse(line) as BridgeMessage;
                this.emit('message', msg);
                this.emit(`message:${msg.type}`, msg.data);
            } catch {
                this.emit('stdout', line);
            }
        }
    }
}
