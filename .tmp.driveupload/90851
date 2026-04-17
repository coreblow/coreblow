/**
 * agents/tool-loop-detection.test.ts
 */
import { describe, it, expect } from 'vitest';
import { detectToolLoop, hashToolArgs, resolveToolLoopConfig, type ToolCallRecord, type ToolLoopDetectionConfig } from './tool-loop-detection.js';

const enabledConfig: ToolLoopDetectionConfig = {
    enabled: true, historySize: 30, warningThreshold: 5, criticalThreshold: 10,
    globalCircuitBreakerThreshold: 30,
    detectors: { genericRepeat: true, knownPollNoProgress: true, pingPong: true },
};

function makeRecords(toolName: string, count: number, argsHash = 'aaa'): ToolCallRecord[] {
    return Array.from({ length: count }, (_, i) => ({ toolName, argsHash, timestamp: Date.now() + i }));
}

describe('Tool Loop Detection', () => {
    describe('hashToolArgs', () => {
        it('hashes consistently', () => {
            expect(hashToolArgs({ a: 1 })).toBe(hashToolArgs({ a: 1 }));
            expect(hashToolArgs({ a: 1 })).not.toBe(hashToolArgs({ a: 2 }));
        });
        it('handles strings', () => expect(hashToolArgs('test')).toHaveLength(16));
        it('handles null', () => expect(hashToolArgs(null)).toHaveLength(16));
    });

    describe('detectToolLoop', () => {
        it('not stuck when disabled', () => {
            const cfg = { ...enabledConfig, enabled: false };
            expect(detectToolLoop(makeRecords('read', 20), cfg).stuck).toBe(false);
        });

        it('not stuck with short history', () => {
            expect(detectToolLoop(makeRecords('read', 1), enabledConfig).stuck).toBe(false);
        });

        it('detects generic repeat at warning', () => {
            const result = detectToolLoop(makeRecords('read_file', 6), enabledConfig);
            expect(result.stuck).toBe(true);
            if (result.stuck) {
                expect(result.detector).toBe('generic_repeat');
                expect(result.level).toBe('warning');
            }
        });

        it('detects generic repeat at critical', () => {
            const result = detectToolLoop(makeRecords('read_file', 12), enabledConfig);
            expect(result.stuck).toBe(true);
            if (result.stuck) expect(result.level).toBe('critical');
        });

        it('detects global circuit breaker', () => {
            const result = detectToolLoop(makeRecords('any', 30), enabledConfig);
            expect(result.stuck).toBe(true);
            if (result.stuck) expect(result.detector).toBe('global_circuit_breaker');
        });

        it('detects ping-pong', () => {
            const records: ToolCallRecord[] = [];
            for (let i = 0; i < 12; i++) {
                records.push({ toolName: i % 2 === 0 ? 'read' : 'write', argsHash: `h${i}`, timestamp: i });
            }
            const result = detectToolLoop(records, enabledConfig);
            expect(result.stuck).toBe(true);
            if (result.stuck) expect(result.detector).toBe('ping_pong');
        });

        it('no ping-pong with same tool', () => {
            expect(detectToolLoop(makeRecords('read', 4), enabledConfig).stuck).toBe(false);
        });
    });

    describe('resolveToolLoopConfig', () => {
        it('returns defaults', () => {
            const cfg = resolveToolLoopConfig();
            expect(cfg.enabled).toBe(false);
            expect(cfg.historySize).toBe(30);
        });
        it('uses overrides', () => {
            const cfg = resolveToolLoopConfig({ tools: { loopDetection: { enabled: true, historySize: 50 } } });
            expect(cfg.enabled).toBe(true);
            expect(cfg.historySize).toBe(50);
        });
    });
});
