/**
 * agents/agent-paths.test.ts
 */
import { describe, it, expect } from 'vitest';
import { resolveAgentDir, resolveAgentPaths, listAgentSessions, resolveDefaultWorkspaceDir, sanitizePath } from './agent-paths.js';
import path from 'node:path';

describe('Agent Paths', () => {
    describe('resolveAgentDir', () => {
        it('resolves base dir', () => {
            expect(resolveAgentDir('/home/user')).toBe(path.join('/home/user', '.coreblow'));
        });
        it('resolves with agent id', () => {
            expect(resolveAgentDir('/home/user', 'agent-1')).toBe(path.join('/home/user', '.coreblow', 'agents', 'agent-1'));
        });
    });

    describe('resolveAgentPaths', () => {
        it('resolves all paths', () => {
            const paths = resolveAgentPaths('/tmp/test/.coreblow');
            expect(paths.sessionsDir).toContain('sessions');
            expect(paths.workspaceDir).toContain('workspace');
            expect(paths.configPath).toContain('agent.json');
            expect(paths.contextDir).toContain('context');
        });
        it('sessionPath is callable', () => {
            const paths = resolveAgentPaths('/tmp/test/.coreblow');
            expect(paths.sessionPath('s1')).toContain('s1');
        });
        it('transcriptPath is callable', () => {
            const paths = resolveAgentPaths('/tmp/test/.coreblow');
            expect(paths.transcriptPath('s1')).toContain('transcript.jsonl');
        });
    });

    describe('listAgentSessions', () => {
        it('returns empty for nonexistent', () => {
            expect(listAgentSessions('/tmp/nonexistent-agent-dir-xyz')).toEqual([]);
        });
    });

    describe('resolveDefaultWorkspaceDir', () => {
        it('uses COREBLOW_WORKSPACE if set', () => {
            expect(resolveDefaultWorkspaceDir({ COREBLOW_WORKSPACE: '/custom' })).toBe('/custom');
        });
        it('falls back to HOME', () => {
            expect(resolveDefaultWorkspaceDir({ HOME: '/home/user' })).toBe('/home/user');
        });
    });

    describe('sanitizePath', () => {
        it('strips null bytes', () => expect(sanitizePath('foo\0bar')).toBe('foobar'));
        it('preserves normal paths', () => expect(sanitizePath('/usr/local/bin')).toBe('/usr/local/bin'));
    });
});
