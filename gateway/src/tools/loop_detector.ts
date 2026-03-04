/**
 * src/tools/loop_detector.ts
 * Detect repeated tool call patterns to prevent infinite loops
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('loop-detector');

interface ToolCallRecord {
    name: string;
    args: string;
    result: string;
    timestamp: number;
}

export class LoopDetector {
    private history: ToolCallRecord[] = [];
    private historySize: number;
    private warningThreshold: number;
    private criticalThreshold: number;
    private circuitBreakerThreshold: number;

    constructor(config?: {
        historySize?: number;
        warningThreshold?: number;
        criticalThreshold?: number;
        circuitBreakerThreshold?: number;
    }) {
        this.historySize = config?.historySize ?? 30;
        this.warningThreshold = config?.warningThreshold ?? 10;
        this.criticalThreshold = config?.criticalThreshold ?? 20;
        this.circuitBreakerThreshold = config?.circuitBreakerThreshold ?? 30;
    }

    /**
     * Record a tool call and check for loops.
     * Returns null if OK, or a warning/error message if loop detected.
     */
    check(name: string, args: Record<string, any>, result: string): string | null {
        const record: ToolCallRecord = {
            name,
            args: JSON.stringify(args),
            result: result.slice(0, 200),
            timestamp: Date.now(),
        };

        this.history.push(record);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }

        // Detector 1: Generic repeat (same tool + same args)
        const repeatCount = this.countRepeats(name, record.args);
        if (repeatCount >= this.circuitBreakerThreshold) {
            log.error({ name, repeats: repeatCount }, 'CIRCUIT BREAKER: tool loop detected');
            this.history = [];
            return `🛑 CIRCUIT BREAKER: Tool "${name}" called ${repeatCount} times with same arguments. Stopping.`;
        }
        if (repeatCount >= this.criticalThreshold) {
            return `⚠️ CRITICAL: Tool "${name}" called ${repeatCount} times with same arguments. Consider a different approach.`;
        }
        if (repeatCount >= this.warningThreshold) {
            return `⚠️ WARNING: Tool "${name}" called ${repeatCount} times with same arguments.`;
        }

        // Detector 2: Poll with no progress (same tool, same result)
        const pollNoProgress = this.countPollNoProgress(name);
        if (pollNoProgress >= 5) {
            return `⚠️ Poll without progress: "${name}" returned same result ${pollNoProgress} times.`;
        }

        // Detector 3: Ping-pong (A → B → A → B alternation)
        const pingPong = this.detectPingPong();
        if (pingPong) {
            return `⚠️ Ping-pong pattern detected between tools: ${pingPong}`;
        }

        return null;
    }

    private countRepeats(name: string, args: string): number {
        return this.history.filter((r) => r.name === name && r.args === args).length;
    }

    private countPollNoProgress(name: string): number {
        const calls = this.history.filter((r) => r.name === name);
        if (calls.length < 3) return 0;

        let count = 1;
        for (let i = calls.length - 2; i >= 0; i--) {
            if (calls[i].result === calls[calls.length - 1].result) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    private detectPingPong(): string | null {
        if (this.history.length < 6) return null;

        const last6 = this.history.slice(-6).map((r) => r.name);
        // A B A B A B
        if (
            last6[0] === last6[2] && last6[2] === last6[4] &&
            last6[1] === last6[3] && last6[3] === last6[5] &&
            last6[0] !== last6[1]
        ) {
            return `${last6[0]} ↔ ${last6[1]}`;
        }

        return null;
    }

    reset() {
        this.history = [];
    }
}
