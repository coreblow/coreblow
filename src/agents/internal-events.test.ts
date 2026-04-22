import { describe, it, expect } from 'vitest';
import {
    formatAgentInternalEventsForPrompt,
    type AgentTaskCompletionInternalEvent,
} from './internal-events.js';

const makeEvent = (overrides?: Partial<AgentTaskCompletionInternalEvent>): AgentTaskCompletionInternalEvent => ({
    type: 'task_completion',
    source: 'subagent',
    childSessionKey: 'child-1',
    childSessionId: 'sess-abc',
    announceType: 'task_complete',
    taskLabel: 'File search',
    status: 'ok',
    statusLabel: 'completed',
    result: 'Found 3 files',
    replyInstruction: 'Summarize the result to the user.',
    ...overrides,
});

describe('formatAgentInternalEventsForPrompt', () => {
    it('returns empty for no events', () => {
        expect(formatAgentInternalEventsForPrompt([])).toBe('');
        expect(formatAgentInternalEventsForPrompt(undefined)).toBe('');
    });

    it('formats single task_completion event', () => {
        const result = formatAgentInternalEventsForPrompt([makeEvent()]);
        expect(result).toContain('CoreBlow runtime context');
        expect(result).toContain('[Internal task completion event]');
        expect(result).toContain('source: subagent');
        expect(result).toContain('session_key: child-1');
        expect(result).toContain('task: File search');
        expect(result).toContain('status: completed');
        expect(result).toContain('Found 3 files');
        expect(result).toContain('BEGIN_UNTRUSTED_CHILD_RESULT');
        expect(result).toContain('END_UNTRUSTED_CHILD_RESULT');
        expect(result).toContain('Summarize the result');
    });

    it('includes stats line when present', () => {
        const result = formatAgentInternalEventsForPrompt([
            makeEvent({ statsLine: '3 turns, 1500 tokens' }),
        ]);
        expect(result).toContain('3 turns, 1500 tokens');
    });

    it('shows (no output) for empty result', () => {
        const result = formatAgentInternalEventsForPrompt([makeEvent({ result: '' })]);
        expect(result).toContain('(no output)');
    });

    it('formats multiple events with separator', () => {
        const result = formatAgentInternalEventsForPrompt([
            makeEvent({ taskLabel: 'Task A' }),
            makeEvent({ taskLabel: 'Task B' }),
        ]);
        expect(result).toContain('Task A');
        expect(result).toContain('Task B');
        expect(result).toContain('---');
    });

    it('includes privacy notice', () => {
        const result = formatAgentInternalEventsForPrompt([makeEvent()]);
        expect(result).toContain('Keep internal details private');
    });
});
