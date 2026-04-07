/**
 * Wave 42: Reply Utilities
 * Tests for typing indicators, auto-topic generation, and command allowlisting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startTyping, stopTyping, stopAllTyping, isTyping } from '../../src/auto-reply/reply/typing.js';
import { generateTopicLabel, extractKeywords, categorizeConversation } from '../../src/auto-reply/reply/auto-topic.js';
import { 
    isCommandAllowed, 
    registerCommandPermission, 
    getAvailableCommands, 
    formatCommandHelp, 
    clearCustomPermissions,
    type UserLevel
} from '../../src/auto-reply/reply/commands-allowlist.js';
import { handleSessionCommand, parseSessionCommand } from '../../src/auto-reply/reply/commands-session.js';
import { acpStart, acpPause, acpResume, acpStop, acpSendMessage, getACPSession, listACPSessions, formatACPStatus, clearACPSessions } from '../../src/auto-reply/reply/commands-acp/lifecycle.js';
import { validateRuntimeOptions, mergeWithDefaults, parseRuntimeOptions } from '../../src/auto-reply/reply/commands-acp/runtime-options.js';
import { handleSubAgentSpawn, handleSubAgentList, handleSubAgentCancel, handleSubAgentAsk, handleSubAgentCommand } from '../../src/auto-reply/reply/commands-subagents/shared.js';

describe('Wave 42: Reply Utilities', () => {

    describe('Typing Indicator (typing.ts)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            stopAllTyping(); // Reset state
        });

        afterEach(() => {
            vi.restoreAllMocks();
            stopAllTyping();
        });

        it('startTyping calls sender immediately and sets interval', () => {
            const sender = vi.fn().mockResolvedValue(undefined);
            
            startTyping('ch1', 'discord', sender, 1000);
            
            expect(sender).toHaveBeenCalledTimes(1); // Immediate call
            expect(isTyping('ch1', 'discord')).toBe(true);
            
            // Advance time
            vi.advanceTimersByTime(1000);
            expect(sender).toHaveBeenCalledTimes(2); // Interval call
        });

        it('stopTyping clears the interval', () => {
            const sender = vi.fn().mockResolvedValue(undefined);
            
            startTyping('ch1', 'discord', sender, 1000);
            stopTyping('ch1', 'discord');
            
            expect(isTyping('ch1', 'discord')).toBe(false);
            
            vi.advanceTimersByTime(2000);
            expect(sender).toHaveBeenCalledTimes(1); // No more calls
        });

        it('stopAllTyping clears all active typing indicators', () => {
            startTyping('ch1', 'discord', vi.fn().mockResolvedValue(undefined), 1000);
            startTyping('ch2', 'discord', vi.fn().mockResolvedValue(undefined), 1000);
            
            stopAllTyping();
            
            expect(isTyping('ch1', 'discord')).toBe(false);
            expect(isTyping('ch2', 'discord')).toBe(false);
        });

        it('startTyping safely catches sender errors', async () => {
            const sender = vi.fn().mockRejectedValue(new Error('Network Error'));
            // Start typing shouldn't throw
            startTyping('ch1', 'telegram', sender, 1000);
            
            // Let interval run
            vi.advanceTimersByTime(1000);
            // Promises rejection handled internally, test simply passes if it doesn't crash
            expect(isTyping('ch1', 'telegram')).toBe(true);
        });
    });

    describe('Auto Topic Generation (auto-topic.ts)', () => {
        it('generateTopicLabel returns default on empty messages', () => {
            expect(generateTopicLabel([])).toBe('New Conversation');
        });

        it('generateTopicLabel extracts exactly if under 50 chars', () => {
            const label = generateTopicLabel([{ role: 'user', content: 'What is the sum of 2+2?' }]);
            expect(label).toBe('What is the sum of 2+2?');
        });

        it('generateTopicLabel breaks at sentence end if short enough', () => {
            const label = generateTopicLabel([{ role: 'user', content: 'This is a long message. It contains multiple sentences and we just need the first.' }]);
            expect(label).toBe('This is a long message.'); // Notice length <= 50, but sentence end is at ~23
        });

        it('generateTopicLabel breaks at word boundary if no sentence end', () => {
            const longText = 'I am trying to write a message that is somewhat longer than fifty characters and has no punctuation at all';
            const label = generateTopicLabel([{ role: 'user', content: longText }]);
            // Expect it to break near 50 chars
            expect(label.endsWith('…')).toBe(true);
            expect(label.length).toBeLessThanOrEqual(56);
        });

        it('extractKeywords extracts most frequent non-stop words', () => {
            const text = 'The code has a bug. I need to fix the bug in the typescript code.';
            const keywords = extractKeywords(text, 2);
            expect(keywords).toEqual(['code', 'bug']); // 'the', 'a', 'has' 'in', 'to', 'i' etc are stop words
        });

        it('categorizeConversation identifies coding', () => {
            const cat = categorizeConversation([
                { role: 'user', content: 'There is an error in my python api class.' }
            ]);
            expect(cat).toBe('coding');
        });

        it('categorizeConversation identifies creative', () => {
            const cat = categorizeConversation([
                { role: 'user', content: 'Lets brainstorm a new story concept and imagine the plot' }
            ]);
            expect(cat).toBe('creative'); // Keywords: brainstorm, concept, imagine -> 3
        });

        it('categorizeConversation defaults to general', () => {
            const cat = categorizeConversation([
                { role: 'user', content: 'I like apples.' }
            ]);
            expect(cat).toBe('general');
        });
    });

    describe('Commands Allowlist (commands-allowlist.ts)', () => {
        beforeEach(() => {
            clearCustomPermissions();
        });

        it('isCommandAllowed allows public commands to everyone', () => {
            expect(isCommandAllowed('/help', 'public')).toBe(true);
            expect(isCommandAllowed('/help', 'user')).toBe(true);
        });

        it('isCommandAllowed restricts commands based on level', () => {
            expect(isCommandAllowed('/system', 'user')).toBe(false); // owner only
            expect(isCommandAllowed('/system', 'admin')).toBe(false);
            expect(isCommandAllowed('/system', 'owner')).toBe(true);
        });

        it('isCommandAllowed supports channel filtering', () => {
            registerCommandPermission({ 
                command: '/custom', 
                minLevel: 'public', 
                description: 'x', 
                channels: ['slack'] 
            });

            expect(isCommandAllowed('/custom', 'public', 'slack')).toBe(true);
            expect(isCommandAllowed('/custom', 'public', 'discord')).toBe(false);
        });

        it('isCommandAllowed restricts unknown commands to trusted+ users', () => {
            expect(isCommandAllowed('/unknownX', 'user')).toBe(false);
            expect(isCommandAllowed('/unknownX', 'trusted')).toBe(true);
            expect(isCommandAllowed('/unknownX', 'admin')).toBe(true);
        });

        it('getAvailableCommands lists standard and custom commands', () => {
            registerCommandPermission({ 
                command: '/foo', minLevel: 'user', description: 'desc' 
            });
            const commands = getAvailableCommands('user');
            
            // Should contain help, model, compact etc, plus /foo
            expect(commands.find(c => c.command === '/help')).toBeDefined();
            expect(commands.find(c => c.command === '/foo')).toBeDefined();
            
            // Neither should contain owner commands
            expect(commands.find(c => c.command === '/reset')).toBeUndefined();
        });

        it('formatCommandHelp formats nicely', () => {
            const helpStr = formatCommandHelp('public');
            expect(helpStr).toContain('Available Commands:');
            expect(helpStr).toContain('/help');
            expect(helpStr).not.toContain('/system');
        });
    });

    // ================================================================
    // GAP FIX: commands-session.ts (91 LOC — previously untested)
    // ================================================================
    describe('Session Commands (commands-session.ts)', () => {
        // imported at top level via ESM

        let mockOps: any;
        const ctx = { sessionId: 'sess-1', userId: 'user-1', args: [] as string[] };

        beforeEach(() => {
            mockOps = {
                createSession: vi.fn().mockReturnValue('sess-new'),
                clearSession: vi.fn(),
                archiveSession: vi.fn(),
                exportSession: vi.fn().mockReturnValue('{"messages":[]}'),
                renameSession: vi.fn(),
                getSessionInfo: vi.fn().mockReturnValue({ model: 'gpt-4o', messages: 12 }),
            };
        });

        it('handles /new command', () => {
            const res = handleSessionCommand('new', ctx, mockOps);
            expect(res.success).toBe(true);
            expect(res.data?.sessionId).toBe('sess-new');
            expect(mockOps.createSession).toHaveBeenCalledWith('user-1');
        });

        it('handles /clear command', () => {
            const res = handleSessionCommand('clear', ctx, mockOps);
            expect(res.success).toBe(true);
            expect(mockOps.clearSession).toHaveBeenCalledWith('sess-1');
        });

        it('handles /fork command with label', () => {
            const res = handleSessionCommand('fork', { ...ctx, args: ['MyBranch'] }, mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('MyBranch');
        });

        it('handles /archive command', () => {
            const res = handleSessionCommand('archive', ctx, mockOps);
            expect(res.success).toBe(true);
            expect(mockOps.archiveSession).toHaveBeenCalledWith('sess-1');
        });

        it('handles /export command', () => {
            const res = handleSessionCommand('export', ctx, mockOps);
            expect(res.success).toBe(true);
            expect(res.data?.export).toBe('{"messages":[]}');
        });

        it('handles /rename command with name', () => {
            const res = handleSessionCommand('rename', { ...ctx, args: ['My', 'Chat'] }, mockOps);
            expect(res.success).toBe(true);
            expect(mockOps.renameSession).toHaveBeenCalledWith('sess-1', 'My Chat');
        });

        it('handles /rename command without name — error', () => {
            const res = handleSessionCommand('rename', { ...ctx, args: [] }, mockOps);
            expect(res.success).toBe(false);
        });

        it('handles /info command', () => {
            const res = handleSessionCommand('info', ctx, mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('model');
        });

        it('handles /info when session not found', () => {
            mockOps.getSessionInfo.mockReturnValueOnce(null);
            const res = handleSessionCommand('info', ctx, mockOps);
            expect(res.success).toBe(false);
        });

        it('handles unknown session command', () => {
            const res = handleSessionCommand('unknown_cmd' as any, ctx, mockOps);
            expect(res.success).toBe(false);
        });

        it('parseSessionCommand extracts command and args', () => {
            const parsed = parseSessionCommand('/rename My Session');
            expect(parsed).toEqual({ command: 'rename', args: ['My', 'Session'] });
        });

        it('parseSessionCommand returns null for non-session commands', () => {
            expect(parseSessionCommand('/model gpt-4')).toBeNull();
            expect(parseSessionCommand('just text')).toBeNull();
        });
    });

    // ================================================================
    // GAP FIX: commands-acp/lifecycle.ts (128 LOC — previously untested)
    // ================================================================
    describe('ACP Lifecycle (commands-acp/lifecycle.ts)', () => {
        // imported at top level via ESM

        let mockOps: any;

        beforeEach(() => {
            clearACPSessions();
            mockOps = {
                createAgent: vi.fn().mockResolvedValue('agent-1'),
                startAgent: vi.fn().mockResolvedValue(undefined),
                pauseAgent: vi.fn().mockResolvedValue(undefined),
                resumeAgent: vi.fn().mockResolvedValue(undefined),
                stopAgent: vi.fn().mockResolvedValue(undefined),
                getAgentStatus: vi.fn().mockReturnValue('active'),
                sendToAgent: vi.fn().mockResolvedValue('Agent response'),
            };
        });

        it('acpStart creates and starts an ACP session', async () => {
            const session = await acpStart('parent-1', { model: 'gpt-4o', tools: ['search'] }, mockOps);
            expect(session.id).toMatch(/^acp_/);
            expect(session.status).toBe('active');
            expect(session.agentId).toBe('agent-1');
            expect(session.parentSessionId).toBe('parent-1');
            expect(session.tools).toEqual(['search']);
            expect(mockOps.createAgent).toHaveBeenCalled();
            expect(mockOps.startAgent).toHaveBeenCalledWith('agent-1');
        });

        it('acpPause pauses an active session', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            const result = await acpPause(session.id, mockOps);
            expect(result).toBe(true);
            expect(getACPSession(session.id)!.status).toBe('paused');
        });

        it('acpPause returns false for non-active session', async () => {
            const result = await acpPause('nonexistent', mockOps);
            expect(result).toBe(false);
        });

        it('acpResume resumes a paused session', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            await acpPause(session.id, mockOps);
            const result = await acpResume(session.id, mockOps);
            expect(result).toBe(true);
            expect(getACPSession(session.id)!.status).toBe('active');
        });

        it('acpResume returns false if not paused', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            const result = await acpResume(session.id, mockOps); // Already active
            expect(result).toBe(false);
        });

        it('acpStop completes an active session', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            const result = await acpStop(session.id, mockOps);
            expect(result).toBe(true);
            expect(getACPSession(session.id)!.status).toBe('completed');
            expect(getACPSession(session.id)!.completedAt).toBeDefined();
        });

        it('acpStop cancels a paused session', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            await acpPause(session.id, mockOps);
            const result = await acpStop(session.id, mockOps);
            expect(result).toBe(true);
            expect(getACPSession(session.id)!.status).toBe('cancelled');
        });

        it('acpSendMessage sends to active session', async () => {
            const session = await acpStart('parent-1', {}, mockOps);
            const response = await acpSendMessage(session.id, 'Hello', mockOps);
            expect(response).toBe('Agent response');
            expect(getACPSession(session.id)!.messageCount).toBe(1);
        });

        it('acpSendMessage returns null for inactive session', async () => {
            const response = await acpSendMessage('nonexistent', 'Hello', mockOps);
            expect(response).toBeNull();
        });

        it('listACPSessions filters by parent', async () => {
            await acpStart('parent-1', {}, mockOps);
            await acpStart('parent-1', {}, mockOps);
            await acpStart('parent-2', {}, mockOps);
            const sessions = listACPSessions('parent-1');
            expect(sessions).toHaveLength(2);
        });

        it('formatACPStatus generates readable output', async () => {
            const session = await acpStart('parent-1', { model: 'gpt-4o' }, mockOps);
            const text = formatACPStatus(session);
            expect(text).toContain('ACP Session');
            expect(text).toContain('gpt-4o');
            expect(text).toContain('active');
        });
    });

    // ================================================================
    // GAP FIX: commands-acp/runtime-options.ts (64 LOC — previously untested)
    // ================================================================
    describe('ACP Runtime Options (commands-acp/runtime-options.ts)', () => {
        // imported at top level via ESM

        it('validateRuntimeOptions passes valid options', () => {
            const result = validateRuntimeOptions({ temperature: 0.7, maxTokens: 4096, maxIterations: 10, timeout: 30000 });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('validateRuntimeOptions catches out-of-range temperature', () => {
            const result = validateRuntimeOptions({ temperature: 3.0 });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('temperature must be 0-2');
        });

        it('validateRuntimeOptions catches negative maxTokens', () => {
            const result = validateRuntimeOptions({ maxTokens: -1 });
            expect(result.valid).toBe(false);
        });

        it('validateRuntimeOptions catches out-of-range maxIterations', () => {
            const result = validateRuntimeOptions({ maxIterations: 200 });
            expect(result.valid).toBe(false);
        });

        it('validateRuntimeOptions catches out-of-range timeout', () => {
            const result = validateRuntimeOptions({ timeout: 100 }); // Under 1s
            expect(result.valid).toBe(false);
        });

        it('mergeWithDefaults fills all missing fields', () => {
            const merged = mergeWithDefaults({});
            expect(merged.model).toBe('gpt-4o');
            expect(merged.maxTokens).toBe(4096);
            expect(merged.temperature).toBe(0.7);
            expect(merged.tools).toEqual([]);
        });

        it('mergeWithDefaults preserves explicit values', () => {
            const merged = mergeWithDefaults({ model: 'claude-3-5-sonnet', temperature: 0.1 });
            expect(merged.model).toBe('claude-3-5-sonnet');
            expect(merged.temperature).toBe(0.1);
        });

        it('parseRuntimeOptions extracts CLI-style args', () => {
            const opts = parseRuntimeOptions(['--model', 'gpt-4o', '--temp', '0.5', '--sandbox', '--tool', 'search']);
            expect(opts.model).toBe('gpt-4o');
            expect(opts.temperature).toBe(0.5);
            expect(opts.sandbox).toBe(true);
            expect(opts.tools).toEqual(['search']);
        });

        it('parseRuntimeOptions handles empty args', () => {
            const opts = parseRuntimeOptions([]);
            expect(opts.model).toBeUndefined();
        });
    });

    // ================================================================
    // GAP FIX: commands-subagents/shared.ts (79 LOC — previously untested)
    // ================================================================
    describe('Sub-Agent Commands (commands-subagents/shared.ts)', () => {
        // imported at top level via ESM

        let mockOps: any;

        beforeEach(() => {
            mockOps = {
                spawn: vi.fn().mockResolvedValue({ id: 'sa-1', name: 'researcher' }),
                list: vi.fn().mockReturnValue([
                    { id: 'sa-1', name: 'researcher', status: 'running', createdAt: Date.now() },
                ]),
                cancel: vi.fn().mockReturnValue(true),
                cancelAll: vi.fn().mockReturnValue(2),
                getResult: vi.fn().mockReturnValue({ content: 'result', status: 'completed' }),
                sendMessage: vi.fn().mockResolvedValue('Agent says hi'),
            };
        });

        it('handleSubAgentSpawn creates sub-agent', async () => {
            const res = await handleSubAgentSpawn(['researcher'], 'parent-1', mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('researcher');
            expect(mockOps.spawn).toHaveBeenCalled();
        });

        it('handleSubAgentSpawn fails without name', async () => {
            const res = await handleSubAgentSpawn([], 'parent-1', mockOps);
            expect(res.success).toBe(false);
        });

        it('handleSubAgentList shows active sub-agents', () => {
            const res = handleSubAgentList('parent-1', mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('researcher');
            expect(res.message).toContain('🟢');
        });

        it('handleSubAgentList shows empty state', () => {
            mockOps.list.mockReturnValueOnce([]);
            const res = handleSubAgentList('parent-1', mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('No active');
        });

        it('handleSubAgentCancel cancels by id', () => {
            const res = handleSubAgentCancel(['sa-1'], 'parent-1', mockOps);
            expect(res.success).toBe(true);
            expect(mockOps.cancel).toHaveBeenCalledWith('sa-1');
        });

        it('handleSubAgentCancel cancels all', () => {
            const res = handleSubAgentCancel(['all'], 'parent-1', mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('2');
        });

        it('handleSubAgentCancel fails without id', () => {
            const res = handleSubAgentCancel([], 'parent-1', mockOps);
            expect(res.success).toBe(false);
        });

        it('handleSubAgentAsk sends message and returns response', async () => {
            const res = await handleSubAgentAsk(['sa-1', 'What', 'is', 'this?'], mockOps);
            expect(res.success).toBe(true);
            expect(res.message).toContain('Agent says hi');
        });

        it('handleSubAgentAsk fails without id or message', async () => {
            const res = await handleSubAgentAsk([], mockOps);
            expect(res.success).toBe(false);
        });

        it('handleSubAgentCommand routes to correct handler', async () => {
            const resList = await handleSubAgentCommand('list', [], 'parent-1', mockOps);
            expect(resList.success).toBe(true);

            const resUnknown = await handleSubAgentCommand('invalid', [], 'parent-1', mockOps);
            expect(resUnknown.success).toBe(false);
        });
    });
});
