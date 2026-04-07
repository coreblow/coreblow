/**
 * Tests for CoreBlow Session Transcript Repair Engine
 */

import { describe, it, expect } from 'vitest';
import {
    detectIssues,
    repairTranscript,
    validateTranscript,
    trimTranscript,
    estimateTranscriptTokens,
    type TranscriptMessage,
} from './session-transcript-repair.js';

const msg = (role: TranscriptMessage['role'], content: string, extra?: Partial<TranscriptMessage>): TranscriptMessage => ({
    role,
    content,
    ...extra,
});

describe('detectIssues', () => {
    it('should detect no issues in valid transcript', () => {
        const messages = [
            msg('system', 'You are a helpful assistant.'),
            msg('user', 'Hello'),
            msg('assistant', 'Hi there!'),
        ];
        const issues = detectIssues(messages);
        expect(issues).toHaveLength(0);
    });

    it('should detect empty content', () => {
        const messages = [
            msg('user', ''),
            msg('assistant', 'Response'),
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'empty_content')).toBe(true);
    });

    it('should detect duplicate messages', () => {
        const messages = [
            msg('user', 'Hello'),
            msg('user', 'Hello'),
            msg('assistant', 'Hi'),
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'duplicate_message')).toBe(true);
    });

    it('should detect orphaned tool results', () => {
        const messages = [
            msg('user', 'Run a command'),
            msg('tool', 'result', { toolCallId: 'nonexistent-call-id' }),
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'orphaned_tool_result')).toBe(true);
    });

    it('should detect missing tool results', () => {
        const messages = [
            msg('user', 'Run a command'),
            msg('assistant', '', {
                toolCalls: [{ id: 'call-1', name: 'exec', arguments: '{}' }],
            }),
            msg('user', 'What happened?'), // No tool result for call-1
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'missing_tool_result')).toBe(true);
    });

    it('should detect malformed tool calls', () => {
        const messages = [
            msg('assistant', '', {
                toolCalls: [{ id: '', name: '', arguments: '{}' }],
            }),
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'malformed_tool_call')).toBe(true);
    });

    it('should detect consecutive user messages', () => {
        const messages = [
            msg('user', 'First message'),
            msg('user', 'Second message'),
        ];
        const issues = detectIssues(messages);
        expect(issues.some((i) => i.type === 'role_sequence_violation')).toBe(true);
    });

    it('should not flag valid tool call → result sequence', () => {
        const messages = [
            msg('user', 'Run something'),
            msg('assistant', '', {
                toolCalls: [{ id: 'call-1', name: 'exec', arguments: '{"cmd":"ls"}' }],
            }),
            msg('tool', 'file1.txt\nfile2.txt', { toolCallId: 'call-1', name: 'exec' }),
            msg('assistant', 'Here are the files.'),
        ];
        const issues = detectIssues(messages);
        expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });
});

describe('repairTranscript', () => {
    it('should remove empty messages', () => {
        const messages = [
            msg('user', ''),
            msg('user', 'Hello'),
            msg('assistant', 'Hi'),
        ];
        const result = repairTranscript(messages);
        expect(result.removedCount).toBe(1);
        expect(result.repaired).toHaveLength(2);
    });

    it('should remove duplicate messages', () => {
        const messages = [
            msg('user', 'Hello'),
            msg('user', 'Hello'),
            msg('assistant', 'Hi'),
        ];
        const result = repairTranscript(messages);
        expect(result.removedCount).toBeGreaterThanOrEqual(1);
    });

    it('should remove orphaned tool results', () => {
        const messages = [
            msg('user', 'Run'),
            msg('tool', 'orphaned result', { toolCallId: 'nonexistent' }),
            msg('assistant', 'Done'),
        ];
        const result = repairTranscript(messages);
        expect(result.removedCount).toBe(1);
        expect(result.repaired.every((m) => m.role !== 'tool' || m.toolCallId !== 'nonexistent')).toBe(true);
    });

    it('should inject placeholder for missing tool results', () => {
        const messages = [
            msg('user', 'Run'),
            msg('assistant', '', {
                toolCalls: [{ id: 'call-1', name: 'exec', arguments: '{}' }],
            }),
        ];
        const result = repairTranscript(messages);
        expect(result.injectedCount).toBe(1);
        expect(result.repaired.some((m) => m.role === 'tool' && m.toolCallId === 'call-1')).toBe(true);
    });

    it('should preserve valid transcript', () => {
        const messages = [
            msg('system', 'You are helpful.'),
            msg('user', 'Hello'),
            msg('assistant', 'Hi!'),
        ];
        const result = repairTranscript(messages);
        expect(result.removedCount).toBe(0);
        expect(result.injectedCount).toBe(0);
        expect(result.repaired).toEqual(messages);
    });

    it('should respect repair options', () => {
        const messages = [
            msg('user', ''),
            msg('user', 'Hello'),
        ];
        const result = repairTranscript(messages, { removeEmpty: false });
        expect(result.removedCount).toBe(0);
    });
});

describe('validateTranscript', () => {
    it('should validate a clean transcript', () => {
        const messages = [
            msg('system', 'Prompt'),
            msg('user', 'Hello'),
            msg('assistant', 'Hi'),
        ];
        const result = validateTranscript(messages);
        expect(result.valid).toBe(true);
        expect(result.messageCount).toBe(3);
        expect(result.roles).toEqual({ system: 1, user: 1, assistant: 1 });
    });

    it('should report invalid for errors', () => {
        const messages = [
            msg('tool', 'orphan', { toolCallId: 'nonexistent' }),
        ];
        const result = validateTranscript(messages);
        expect(result.valid).toBe(false);
        expect(result.issueCount).toBeGreaterThan(0);
    });
});

describe('trimTranscript', () => {
    it('should return all messages when under limit', () => {
        const messages = [
            msg('system', 'Prompt'),
            msg('user', 'Hello'),
        ];
        const result = trimTranscript(messages, 10);
        expect(result).toHaveLength(2);
    });

    it('should keep system messages when trimming', () => {
        const messages = [
            msg('system', 'Prompt'),
            msg('user', 'Old message'),
            msg('assistant', 'Old response'),
            msg('user', 'New message'),
            msg('assistant', 'New response'),
        ];
        const result = trimTranscript(messages, 3);
        expect(result).toHaveLength(3);
        expect(result[0]!.role).toBe('system');
        expect(result[result.length - 1]!.content).toBe('New response');
    });
});

describe('estimateTranscriptTokens', () => {
    it('should estimate tokens', () => {
        const messages = [
            msg('user', 'Hello world'),
            msg('assistant', 'Hi there! How can I help?'),
        ];
        const tokens = estimateTranscriptTokens(messages);
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThan(100);
    });

    it('should include tool call tokens', () => {
        const messages = [
            msg('assistant', '', {
                toolCalls: [{ id: 'c1', name: 'exec', arguments: '{"command":"ls -la"}' }],
            }),
        ];
        const tokens = estimateTranscriptTokens(messages);
        expect(tokens).toBeGreaterThan(4); // More than just role overhead
    });
});
