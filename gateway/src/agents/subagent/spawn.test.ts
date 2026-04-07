// @ts-nocheck
import { describe, it, expect } from 'vitest';
import {
    splitModelRef,
    buildSubagentSystemPrompt,
    SUBAGENT_SPAWN_MODES,
    SUBAGENT_SPAWN_SANDBOX_MODES,
    SUBAGENT_SPAWN_ACCEPTED_NOTE,
    SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE,
} from './subagent-spawn.js';

describe('Subagent Spawn — Phase 13', () => {

    // ─── Constants ─────────────────────────────────────────────

    describe('constants', () => {
        it('spawn modes are correct', () => {
            expect(SUBAGENT_SPAWN_MODES).toEqual(['run', 'session']);
        });

        it('sandbox modes are correct', () => {
            expect(SUBAGENT_SPAWN_SANDBOX_MODES).toEqual(['inherit', 'require']);
        });

        it('accepted note mentions auto-announce', () => {
            expect(SUBAGENT_SPAWN_ACCEPTED_NOTE).toContain('Auto-announce');
        });

        it('session accepted note mentions thread', () => {
            expect(SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE).toContain('thread');
        });
    });

    // ─── splitModelRef ─────────────────────────────────────────

    describe('splitModelRef', () => {
        it('returns empty for undefined', () => {
            const { provider, model } = splitModelRef(undefined);
            expect(provider).toBeUndefined();
            expect(model).toBeUndefined();
        });

        it('returns empty for blank string', () => {
            const { provider, model } = splitModelRef('   ');
            expect(provider).toBeUndefined();
            expect(model).toBeUndefined();
        });

        it('returns model only for no slash', () => {
            const { provider, model } = splitModelRef('gpt-4o');
            expect(provider).toBeUndefined();
            expect(model).toBe('gpt-4o');
        });

        it('splits provider/model on slash', () => {
            const { provider, model } = splitModelRef('openai/gpt-4o');
            expect(provider).toBe('openai');
            expect(model).toBe('gpt-4o');
        });

        it('splits anthropic/claude-sonnet-4-20250514', () => {
            const { provider, model } = splitModelRef('anthropic/claude-sonnet-4-20250514');
            expect(provider).toBe('anthropic');
            expect(model).toBe('claude-sonnet-4-20250514');
        });
    });

    // ─── buildSubagentSystemPrompt ─────────────────────────────

    describe('buildSubagentSystemPrompt', () => {
        it('includes session key', () => {
            const prompt = buildSubagentSystemPrompt({
                requesterSessionKey: 'parent-1',
                childSessionKey: 'child-1',
                task: 'analyze code',
                childDepth: 1,
                maxSpawnDepth: 3,
            });
            expect(prompt).toContain('child-1');
            expect(prompt).toContain('parent-1');
            expect(prompt).toContain('1/3');
        });

        it('includes label when provided', () => {
            const prompt = buildSubagentSystemPrompt({
                requesterSessionKey: 'parent',
                childSessionKey: 'child',
                label: 'Code Analyzer',
                task: 'review',
                childDepth: 2,
                maxSpawnDepth: 5,
            });
            expect(prompt).toContain('Code Analyzer');
        });

        it('omits label when not provided', () => {
            const prompt = buildSubagentSystemPrompt({
                childSessionKey: 'child',
                task: 'test',
                childDepth: 1,
                maxSpawnDepth: 3,
            });
            expect(prompt).not.toContain('Label:');
        });

        it('contains anti-polling instruction', () => {
            const prompt = buildSubagentSystemPrompt({
                childSessionKey: 'child',
                task: 'test',
                childDepth: 1,
                maxSpawnDepth: 3,
            });
            expect(prompt).toContain('Do NOT call sessions_list');
        });

        it('mentions auto-announce', () => {
            const prompt = buildSubagentSystemPrompt({
                childSessionKey: 'child',
                task: 'test',
                childDepth: 1,
                maxSpawnDepth: 3,
            });
            expect(prompt).toContain('automatically announced');
        });
    });
});
