/**
 * Wave 37: Turn Engine Autopilot
 *
 * Tests turn engine queueing, abort mechanics, heartbeat monitoring,
 * text dispatch processing, commands, sessions, and reply formatting.
 * TARGET: ~35 tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enqueue } from '../../src/agents/turn-engine/autopilot/queue/enqueue.js';
import { dequeue } from '../../src/agents/turn-engine/autopilot/queue/dequeue.js';
import { resetQueues } from '../../src/agents/turn-engine/autopilot/queue/reset-queues.js';
import { queueSize } from '../../src/agents/turn-engine/autopilot/queue/queue-size.js';

import { createRunAbort } from '../../src/agents/turn-engine/autopilot/abort/create-run-abort.js';
import { abortRun } from '../../src/agents/turn-engine/autopilot/abort/abort-run.js';
import { abortAll } from '../../src/agents/turn-engine/autopilot/abort/abort-all.js';
import { resetAborts } from '../../src/agents/turn-engine/autopilot/abort/reset-aborts.js';
import { hasActiveRun } from '../../src/agents/turn-engine/autopilot/abort/has-active-run.js';

import { recordDiagnostic } from '../../src/agents/turn-engine/autopilot/heartbeat/record-diagnostic.js';
import { getDiagnostics } from '../../src/agents/turn-engine/autopilot/heartbeat/get-diagnostics.js';
import { resetDiagnostics } from '../../src/agents/turn-engine/autopilot/heartbeat/reset-diagnostics.js';
import { estimateTokens } from '../../src/agents/turn-engine/autopilot/heartbeat/estimate-tokens.js';

import { normalizeInboundText } from '../../src/agents/turn-engine/autopilot/dispatch/normalize-inbound-text.js';
import { stripInboundMeta } from '../../src/agents/turn-engine/autopilot/dispatch/strip-inbound-meta.js';

import { splitIntoBlocks } from '../../src/agents/turn-engine/autopilot/reply/split-into-blocks.js';
import { hasContent } from '../../src/agents/turn-engine/autopilot/reply/has-content.js';

import { registerCommand } from '../../src/agents/turn-engine/autopilot/commands/register-command.js';
import { matchCommand } from '../../src/agents/turn-engine/autopilot/commands/match-command.js';
import { resetCommands } from '../../src/agents/turn-engine/autopilot/commands/reset-commands.js';

import { getOrCreateSession } from '../../src/agents/turn-engine/autopilot/session/get-or-create-session.js';
import { deleteSession } from '../../src/agents/turn-engine/autopilot/session/delete-session.js';
import { resetSessions } from '../../src/agents/turn-engine/autopilot/session/reset-sessions.js';

import { parseDirectives } from '../../src/agents/turn-engine/autopilot/directives/parse-directives.js';

// ─── Queue Management ─────────────────────────────────────────────────────

describe('Queue Management', () => {
    beforeEach(() => { resetQueues(); });

    it('enqueues messages and tracks size', () => {
        expect(queueSize('s1')).toBe(0);
        enqueue('s1', { role: 'user', content: 'Low' });
        expect(queueSize('s1')).toBe(1);
    });

    it('enqueues messages with priority sorting', () => {
        enqueue('s1', { role: 'user', content: 'Low' }, undefined, 0);
        enqueue('s1', { role: 'user', content: 'High' }, undefined, 10);
        enqueue('s1', { role: 'user', content: 'Medium' }, undefined, 5);
        expect(queueSize('s1')).toBe(3);
        const top = dequeue('s1');
        expect(top?.message.content).toBe('High');
    });

    it('dequeues standard (FIFO after priority)', () => {
        enqueue('s1', { role: 'user', content: '1' });
        enqueue('s1', { role: 'user', content: '2' });
        expect(dequeue('s1')?.message.content).toBe('1');
        expect(dequeue('s1')?.message.content).toBe('2');
        expect(dequeue('s1')).toBeUndefined();
    });

    it('dequeues with latest policy drops older items', () => {
        enqueue('s2', { role: 'user', content: 'Old' });
        enqueue('s2', { role: 'user', content: 'New' });
        expect(dequeue('s2', 'latest')?.message.content).toBe('New');
        expect(dequeue('s2')).toBeUndefined();
    });

    it('resetQueues implicitly clears all sessions', () => {
        enqueue('s1', { role: 'user', content: 'a' });
        enqueue('s2', { role: 'user', content: 'b' });
        resetQueues();
        expect(queueSize('s1')).toBe(0);
        expect(queueSize('s2')).toBe(0);
    });
});

// ─── Abort Logic ──────────────────────────────────────────────────────────

describe('Abort Mechanics', () => {
    beforeEach(() => { resetAborts(); });

    it('creates run abort controller and updates state', () => {
        expect(hasActiveRun('s1')).toBe(false);
        const ctrl = createRunAbort('s1', 'r1');
        expect(ctrl).toBeInstanceOf(AbortController);
        expect(hasActiveRun('s1')).toBe(true);
    });

    it('aborts individual run correctly', () => {
        const ctrl = createRunAbort('s1', 'r1');
        expect(ctrl.signal.aborted).toBe(false);
        const ok = abortRun('s1', 'timeout');
        expect(ok).toBe(true);
        expect(ctrl.signal.aborted).toBe(true);
        expect(ctrl.signal.reason).toBe('timeout');
        expect(hasActiveRun('s1')).toBe(false);
    });

    it('abortRun returns false if no active run', () => {
        expect(abortRun('missing')).toBe(false);
    });

    it('aborts all active runs', () => {
        const c1 = createRunAbort('s1', 'r1');
        const c2 = createRunAbort('s2', 'r2');
        const count = abortAll('system');
        expect(count).toBe(2);
        expect(c1.signal.aborted).toBe(true);
        expect(c2.signal.aborted).toBe(true);
        expect(hasActiveRun('s1')).toBe(false);
    });

    it('new run creation aborts previous quietly', () => {
        const c1 = createRunAbort('s1', 'r1');
        const c2 = createRunAbort('s1', 'r2');
        expect(c1.signal.aborted).toBe(true);
        expect(c1.signal.reason).toBe('new_message');
        expect(c2.signal.aborted).toBe(false);
    });
});

// ─── Dispatch Normalization ───────────────────────────────────────────────

describe('Dispatch Processing', () => {
    it('normalizes inbound whitespace', () => {
        const txt = 'Hello\r\nWorld\r\u200B Space ';
        expect(normalizeInboundText(txt)).toBe('Hello\nWorld\n Space');
    });

    it('normalizes inbound empty text', () => {
        expect(normalizeInboundText('   \n\r  ')).toBe('');
    });

    it('strips inbound meta and extracts attributes', () => {
        const raw = 'Hey @bot, please process. [context:work] [priority:high]';
        const res = stripInboundMeta(raw);
        expect(res.cleanText).toBe('Hey , please process.');
        expect(res.meta['context']).toBe('work');
        expect(res.meta['priority']).toBe('high');
    });

    it('stripInboundMeta handles no meta tags safely', () => {
        const raw = 'Just text';
        const res = stripInboundMeta(raw);
        expect(res.cleanText).toBe('Just text');
        expect(Object.keys(res.meta)).toHaveLength(0);
    });
});

// ─── Heartbeat / Diagnostics ──────────────────────────────────────────────

describe('Heartbeat & Diagnostics', () => {
    beforeEach(() => { resetDiagnostics(); });

    it('records and gets diagnostics with timestamp', () => {
        recordDiagnostic({ runId: 'r1', category: 'test', message: 'testing' });
        const diags = getDiagnostics();
        expect(diags).toHaveLength(1);
        expect(diags[0].category).toBe('test');
        expect(diags[0].message).toBe('testing');
        expect(typeof diags[0].timestamp).toBe('number');
    });

    it('filters diagnostics by category', () => {
        recordDiagnostic({ runId: 'r1', category: 'auth', message: 'testing' });
        recordDiagnostic({ runId: 'r2', category: 'net', message: 'testing' });
        expect(getDiagnostics('auth')).toHaveLength(1);
        expect(getDiagnostics('net')).toHaveLength(1);
    });

    it('estimates tokens simplistically', () => {
        expect(estimateTokens('1234')).toBe(1);
        expect(estimateTokens('12345678')).toBe(2);
        expect(estimateTokens('')).toBe(0);
    });
});

// ─── Reply Formatter ──────────────────────────────────────────────────────

describe('Reply Formatter', () => {
    it('splitIntoBlocks cuts text by size', () => {
        const blocks = splitIntoBlocks('Hello\n\nWorld', 5);
        expect(blocks).toEqual(['Hello', 'World']);
    });

    it('splitIntoBlocks handles empty strings safely', () => {
        expect(splitIntoBlocks('', 10)).toEqual(['']);
    });

    it('hasContent validates payload content presence', () => {
        expect(hasContent({ text: 'yes' })).toBe(true);
        expect(hasContent({ mediaUrl: 'test.jpg' })).toBe(true);
        expect(hasContent({})).toBe(false);
        expect(hasContent({ text: '' })).toBe(false);
    });
});

// ─── Commands API ─────────────────────────────────────────────────────────

describe('Commands API', () => {
    beforeEach(() => { resetCommands(); });

    it('registers and matches commands', () => {
        registerCommand({ name: 'help', description: 'desc', handler: vi.fn() as any });
        const match = matchCommand('/help');
        expect(match).not.toBeNull();
        expect(match?.name).toBe('help');
    });

    it('does not match unregistered forms', () => {
        registerCommand({ name: 'help', description: 'desc', handler: vi.fn() as any });
        expect(matchCommand('/unknown')).toBeNull();
    });

    it('resetCommands clears definitions', () => {
        registerCommand({ name: 'test', description: 'desc', handler: vi.fn() as any });
        resetCommands();
        expect(matchCommand('/test')).toBeNull();
    });
});

// ─── Session State Tracking ───────────────────────────────────────────────

describe('Session State Tracker', () => {
    beforeEach(() => { resetSessions(); });

    it('getOrCreateSession initializes state structure', () => {
        const state = getOrCreateSession('s1', 'agentA');
        expect(state.agentId).toBe('agentA');
        expect(state.isActive).toBe(true);
        expect(state.turnCount).toBe(0);
    });

    it('getOrCreateSession returns existing state on repeat calls', () => {
        const state1 = getOrCreateSession('s1', 'agentA');
        state1.isActive = false;
        const state2 = getOrCreateSession('s1', 'agentA');
        expect(state2.isActive).toBe(false);
    });

    it('deleteSession removes and returns tracking status', () => {
        getOrCreateSession('s1', 'agentA');
        expect(deleteSession('s1')).toBe(true);
        expect(deleteSession('s1')).toBe(false);
    });
});

// ─── Directives Parser ────────────────────────────────────────────────────

describe('Directives Parser', () => {
    it('parses valid inline directives', () => {
        const res = parseDirectives('Hello [model:gpt-4] and [think:high]');
        expect(res.directives).toHaveLength(2);
        expect(res.directives[0].type).toBe('model');
        expect(res.directives[0].value).toBe('gpt-4');
        expect(res.directives[1].type).toBe('think');
        expect(res.directives[1].value).toBe('high');
    });

    it('strips directives from content', () => {
        const res = parseDirectives('Start [model:gpt] End');
        expect(res.cleanedText).toBe('Start  End');
    });

    it('handles text without directives safely', () => {
        const res = parseDirectives('Normal sentence.');
        expect(res.directives).toHaveLength(0);
        expect(res.cleanedText).toBe('Normal sentence.');
    });
});
