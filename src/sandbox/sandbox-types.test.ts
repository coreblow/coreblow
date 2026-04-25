import { describe, it, expect } from 'vitest';
import type { ExecResult, CommandRiskLevel } from './sandbox-types.js';

describe('ExecResult interface', () => {
    it('represents a successful execution', () => {
        const result: ExecResult = {
            stdout: 'hello world\n',
            stderr: '',
            exitCode: 0,
            timedOut: false,
            truncated: false,
            mode: 'host',
        };
        expect(result.exitCode).toBe(0);
        expect(result.timedOut).toBe(false);
        expect(result.stdout).toContain('hello');
    });

    it('represents a failed execution with signal', () => {
        const result: ExecResult = {
            stdout: '',
            stderr: 'killed',
            exitCode: 137,
            signal: 'SIGKILL',
            timedOut: true,
            truncated: false,
            mode: 'docker',
        };
        expect(result.exitCode).toBe(137);
        expect(result.signal).toBe('SIGKILL');
        expect(result.timedOut).toBe(true);
        expect(result.mode).toBe('docker');
    });

    it('supports all execution modes', () => {
        const modes: ExecResult['mode'][] = ['docker', 'restricted-native', 'host'];
        for (const mode of modes) {
            const r: ExecResult = { stdout: '', stderr: '', exitCode: 0, timedOut: false, truncated: false, mode };
            expect(r.mode).toBe(mode);
        }
    });

    it('represents truncated output', () => {
        const result: ExecResult = {
            stdout: 'partial output...',
            stderr: '',
            exitCode: 0,
            timedOut: false,
            truncated: true,
            mode: 'restricted-native',
        };
        expect(result.truncated).toBe(true);
    });
});

describe('CommandRiskLevel type', () => {
    it('supports all risk levels', () => {
        const levels: CommandRiskLevel[] = ['low', 'medium', 'high'];
        expect(levels).toHaveLength(3);
        expect(levels).toContain('low');
        expect(levels).toContain('medium');
        expect(levels).toContain('high');
    });
});
