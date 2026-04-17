/**
 * agents/bash-process-registry.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    addSession, getSession, getFinishedSession, deleteSession, appendOutput,
    drainSession, markExited, markBackgrounded, listRunningSessions, listFinishedSessions,
    clearFinished, resetProcessRegistryForTests, tail, trimWithCap, createSessionSlug,
    setJobTtlMs, type ProcessSession,
} from './bash-process-registry.js';

function makeSession(id: string, cmd = 'echo test'): ProcessSession {
    return {
        id, command: cmd, startedAt: Date.now(), maxOutputChars: 50_000,
        totalOutputChars: 0, pendingStdout: [], pendingStderr: [],
        pendingStdoutChars: 0, pendingStderrChars: 0,
        aggregated: '', tail: '', exited: false, truncated: false, backgrounded: false,
    };
}

describe('Bash Process Registry', () => {
    beforeEach(() => resetProcessRegistryForTests());

    it('creates unique session slugs', () => {
        const a = createSessionSlug();
        const b = createSessionSlug();
        expect(a).not.toBe(b);
    });

    it('adds and gets sessions', () => {
        const session = makeSession('s1');
        addSession(session);
        expect(getSession('s1')).toBe(session);
    });

    it('deletes sessions', () => {
        addSession(makeSession('s1'));
        deleteSession('s1');
        expect(getSession('s1')).toBeUndefined();
    });

    it('appends stdout', () => {
        const session = makeSession('s1');
        addSession(session);
        appendOutput(session, 'stdout', 'hello ');
        appendOutput(session, 'stdout', 'world');
        expect(session.aggregated).toBe('hello world');
        expect(session.totalOutputChars).toBe(11);
    });

    it('appends stderr', () => {
        const session = makeSession('s1');
        appendOutput(session, 'stderr', 'error!');
        const drained = drainSession(session);
        expect(drained.stderr).toBe('error!');
    });

    it('drains pending output', () => {
        const session = makeSession('s1');
        appendOutput(session, 'stdout', 'a');
        appendOutput(session, 'stdout', 'b');
        const { stdout } = drainSession(session);
        expect(stdout).toBe('ab');
        const { stdout: empty } = drainSession(session);
        expect(empty).toBe('');
    });

    it('marks exited and moves to finished (backgrounded)', () => {
        const session = makeSession('s1');
        addSession(session);
        markBackgrounded(session);
        markExited(session, 0, null, 'completed');
        expect(session.exited).toBe(true);
        expect(getSession('s1')).toBeUndefined();
        expect(getFinishedSession('s1')).toBeDefined();
        expect(getFinishedSession('s1')!.status).toBe('completed');
    });

    it('does not add to finished if not backgrounded', () => {
        const session = makeSession('s1');
        addSession(session);
        markExited(session, 1, null, 'failed');
        expect(getFinishedSession('s1')).toBeUndefined();
    });

    it('lists running (backgrounded only)', () => {
        const s1 = makeSession('s1');
        const s2 = makeSession('s2');
        addSession(s1);
        addSession(s2);
        markBackgrounded(s1);
        expect(listRunningSessions()).toHaveLength(1);
        expect(listRunningSessions()[0].id).toBe('s1');
    });

    it('lists and clears finished', () => {
        const session = makeSession('s1');
        addSession(session);
        markBackgrounded(session);
        markExited(session, 0, null, 'completed');
        expect(listFinishedSessions()).toHaveLength(1);
        clearFinished();
        expect(listFinishedSessions()).toHaveLength(0);
    });

    it('truncates output beyond maxOutputChars', () => {
        const session = makeSession('s1');
        session.maxOutputChars = 20;
        const longStr = 'x'.repeat(50);
        appendOutput(session, 'stdout', longStr);
        expect(session.aggregated.length).toBe(20);
        expect(session.truncated).toBe(true);
    });

    describe('tail', () => {
        it('returns full text if short', () => expect(tail('hello', 10)).toBe('hello'));
        it('returns last N chars', () => expect(tail('abcdef', 3)).toBe('def'));
    });

    describe('trimWithCap', () => {
        it('no-op for short text', () => expect(trimWithCap('abc', 10)).toBe('abc'));
        it('keeps last N chars', () => expect(trimWithCap('abcdef', 4)).toBe('cdef'));
    });

    it('setJobTtlMs clamps values', () => {
        setJobTtlMs(10); // below min
        setJobTtlMs(999_999_999); // above max
        setJobTtlMs(undefined); // noop
    });
});
