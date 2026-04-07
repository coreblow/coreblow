/**
 * Wave 38: E2E Agent Integration
 *
 * Tests full end-to-end scenarios bringing together:
 * - AgentRuntime
 * - Tools & Execution Context
 * - Turn Engine Mechanics
 * - Context Management (truncation, facts)
 * TARGET: ~30 tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentRuntime, type ModelProvider, type SessionState, type ConversationMessage } from '../../src/agents/runtime.js';
import { enqueue } from '../../src/agents/turn-engine/autopilot/queue/enqueue.js';
import { dequeue } from '../../src/agents/turn-engine/autopilot/queue/dequeue.js';
import { resetQueues } from '../../src/agents/turn-engine/autopilot/queue/reset-queues.js';
import { queueSize } from '../../src/agents/turn-engine/autopilot/queue/queue-size.js';

// ─── Mock Provider ────────────────────────────────────────────────────────

class E2EMockProvider implements ModelProvider {
    id = 'e2e-mock';
    name = 'E2E Provider';

    public errorOnNext = false;
    public injectToolCall: string | null = null;
    public streamChunks: string[] = [];

    async chat(params: any) {
        if (this.errorOnNext) {
            this.errorOnNext = false;
            throw new Error('Simulated Provider Error');
        }

        const lastMsg = params.messages[params.messages.length - 1];

        // Simulate tool instruction from test
        if (this.injectToolCall) {
            const tc = this.injectToolCall;
            this.injectToolCall = null;
            return {
                content: '',
                toolCalls: [{ id: 'tc_1', name: tc, arguments: '{"task":"test_task"}' }],
                usage: { input: 10, output: 5, total: 15 }
            };
        }

        // Handle tool result (it will be followed by an empty user message due to recursion)
        const toolMsgIndex = lastMsg.role === 'tool' ? params.messages.length - 1 : 
                             (lastMsg.content === '' && params.messages.length >= 2 && params.messages[params.messages.length - 2].role === 'tool') 
                             ? params.messages.length - 2 : -1;
                             
        if (toolMsgIndex >= 0) {
            return {
                content: 'Acknowledged tool result: ' + params.messages[toolMsgIndex].content,
                usage: { input: 5, output: 10, total: 15 }
            };
        }

        // Basic answers
        if (lastMsg.content.includes('what is my name')) {
            return {
                content: 'Your name is alice',
                usage: { input: 10, output: 5, total: 15 }
            };
        }

        return {
            content: 'Processed: ' + lastMsg.content,
            usage: { input: 10, output: 10, total: 20 }
        };
    }
}

// ─── E2E Integration Tests ────────────────────────────────────────────────

describe('E2E Agent Integration & Runtime', () => {
    let runtime: AgentRuntime;
    let provider: E2EMockProvider;

    beforeEach(() => {
        runtime = new AgentRuntime();
        provider = new E2EMockProvider();
        runtime.registerProvider(provider, true);
        resetQueues();
    });

    // ─── Session Lifecycle ───
    describe('Session Lifecycle & Runtime Management', () => {
        it('registers providers and assigns default successfully', () => {
            const r2 = new AgentRuntime();
            const p2 = new E2EMockProvider();
            r2.registerProvider(p2, true);
            const s = r2.createSession('s1', { model: 'mock' });
            expect(s).toBeDefined();
        });

        it('throws error if creating session with no provider', () => {
            const rEmpty = new AgentRuntime();
            expect(() => rEmpty.createSession('s1', { model: 'mock' })).toThrow(/No model provider/);
        });

        it('creates and retrieves a session by ID', () => {
            const s1 = runtime.createSession('test_1', { model: 'm1' });
            expect(s1.id).toBe('test_1');
            const retrieved = runtime.getSession('test_1');
            expect(retrieved).toBe(s1);
        });

        it('throws error when creating duplicate session keys', () => {
            runtime.createSession('dup', { model: 'm1' });
            expect(() => runtime.createSession('dup', { model: 'm2' })).toThrow(/already exists/);
        });

        it('returns null when getting non-existent session', () => {
            expect(runtime.getSession('none')).toBeNull();
        });

        it('destroys sessions cleanly', () => {
            runtime.createSession('d1', { model: 'm' });
            expect(runtime.destroySession('d1')).toBe(true);
            expect(runtime.getSession('d1')).toBeNull();
            expect(runtime.destroySession('d1')).toBe(false); // already gone
        });

        it('lists active sessions with metadata', () => {
            runtime.createSession('l1', { model: 'm' });
            runtime.createSession('l2', { model: 'm' });
            const list = runtime.listSessions();
            expect(list).toHaveLength(2);
            expect(list.map(l => l.id)).toEqual(expect.arrayContaining(['l1', 'l2']));
            expect(list[0].state).toBe('idle');
            expect(list[0].messageCount).toBe(0);
        });

        it('listSessions reflects system prompt in message count', () => {
            runtime.createSession('l_sys', { model: 'm', systemPrompt: 'Be helpful' });
            const list = runtime.listSessions();
            expect(list[0].messageCount).toBe(1); // system message
        });
    });

    // ─── Core Conversational Capabilities ───
    describe('Conversation & Context Management', () => {
        it('inits with system prompt if provided', () => {
            const s = runtime.createSession('sys_1', { model: 'm', systemPrompt: 'System Instruction' });
            expect(s.getMessages()).toHaveLength(1);
            expect(s.getMessages()[0].content).toBe('System Instruction');
            expect(s.getMessages()[0].role).toBe('system');
        });

        it('processes standard string chat and updates state safely', async () => {
            const s = runtime.createSession('c_1', { model: 'm' });
            expect(s.getState()).toBe('idle');
            
            const reply = await s.chat('hello engine');
            expect(reply).toBe('Processed: hello engine');
            expect(s.getState()).toBe('idle'); // returns to idle after completion
        });

        it('records conversational turns correctly in message array', async () => {
            const s = runtime.createSession('t_1', { model: 'm' });
            await s.chat('what is my name');
            const msgs = s.getMessages();
            
            expect(msgs).toHaveLength(2); // user, assistant
            expect(msgs[0].role).toBe('user');
            expect(msgs[0].content).toBe('what is my name');
            expect(msgs[1].role).toBe('assistant');
            expect(msgs[1].content).toBe('Your name is alice');
        });

        it('supports simulated streaming callbacks', async () => {
            const s = runtime.createSession('st_1', { model: 'm' });
            const streamCb = vi.fn();
            
            await s.chat('hi', streamCb);
            expect(streamCb).toHaveBeenCalled();
            expect(streamCb).toHaveBeenCalledWith('Processed: hi', true); // mock is simple, yields 1 chunk
        });

        it('handles exceptions gracefully, recording error state', async () => {
            const s = runtime.createSession('err_1', { model: 'm' });
            provider.errorOnNext = true;
            
            await expect(s.chat('break things')).rejects.toThrow('Simulated Provider Error');
            expect(s.getState()).toBe('error');
        });

        it('tracks token usage incrementally', async () => {
            const s = runtime.createSession('tok_1', { model: 'm' });
            
            // First turn
            await s.chat('turn 1');
            let usage = s.getTokenUsage();
            expect(usage.input).toBe(10);
            expect(usage.output).toBe(10);
            expect(usage.total).toBe(20);

            // Second turn
            await s.chat('what is my name');
            usage = s.getTokenUsage();
            expect(usage.input).toBe(20); // 10 + 10
            expect(usage.output).toBe(15); // 10 + 5
            expect(usage.total).toBe(35); // 20 + 15
        });
    });

    // ─── Tools & Subagent Execution ───
    describe('Tool & Subagent Execution Lifecycle', () => {
        it('executes simple tool mappings automatically', async () => {
            let toolCalled = false;
            const s = runtime.createSession('tool_1', {
                model: 'm',
                tools: [{
                    name: 'calculator',
                    description: 'calculates',
                    parameters: { type: 'object' },
                    handler: async () => { toolCalled = true; return 'calc result 42'; }
                }]
            });

            provider.injectToolCall = 'calculator';
            const reply = await s.chat('do math');
            
            expect(toolCalled).toBe(true);
            expect(reply).toBe('Acknowledged tool result: calc result 42');
            
            const msgs = s.getMessages();
            expect(msgs.filter(m => m.role === 'tool')).toHaveLength(1);
            expect(msgs.find(m => m.role === 'tool')?.content).toBe('calc result 42');
        });

        it('handles subagent spawn tool explicitly', async () => {
            let taskPassed = '';
            const s = runtime.createSession('sub_1', {
                model: 'm',
                tools: [{
                    name: 'spawn_subagent',
                    description: 'spawns child',
                    parameters: { type: 'object' },
                    handler: async (args: any) => { 
                        taskPassed = args.task;
                        return `Spawned child for [${args.task}]`;
                    }
                }]
            });

            provider.injectToolCall = 'spawn_subagent';
            const reply = await s.chat('delegate work');
            
            expect(taskPassed).toBe('test_task');
            expect(reply).toContain('Acknowledged tool result: Spawned child for [test_task]');
        });

        it('records proper tool call artifacts in message context', async () => {
            const s = runtime.createSession('ctx_1', {
                model: 'm',
                tools: [{
                    name: 'get_weather',
                    description: 'weather check',
                    parameters: { type: 'object' },
                    handler: async () => 'sunny'
                }]
            });

            provider.injectToolCall = 'get_weather';
            await s.chat('weather?');
            
            const asstMsg = s.getMessages().find(m => m.toolCalls && m.toolCalls.length > 0);
            expect(asstMsg).toBeDefined();
            expect(asstMsg?.toolCalls?.[0].name).toBe('get_weather');
            expect(asstMsg?.toolCalls?.[0].id).toBe('tc_1');

            const toolMsg = s.getMessages().find(m => m.role === 'tool');
            expect(toolMsg).toBeDefined();
            expect(toolMsg?.toolCallId).toBe('tc_1'); // Must map correctly to provider semantics
        });

        it('handles tool execution failures gracefully inside handler', async () => {
            const s = runtime.createSession('err_t1', {
                model: 'm',
                tools: [{
                    name: 'fail_tool',
                    description: 'fails',
                    parameters: {},
                    handler: async () => { throw new Error('Tool crashed'); }
                }]
            });

            provider.injectToolCall = 'fail_tool';
            const reply = await s.chat('do fail');
            
            // The agent catches the error and reports it back to the provider as a tool reply
            expect(reply).toContain('Tool crashed');
            const toolMsg = s.getMessages().find(m => m.role === 'tool');
            expect(toolMsg?.content).toContain('Tool crashed');
            expect(s.getState()).toBe('idle'); // recovers nicely
        });
    });

    // ─── Turn Engine & Queuing Connectors ───
    describe('Turn Engine E2E Connectors', () => {
        it('enqueues messages via TurnEngine autopilot before processing', () => {
            const sId = 't_e_1';
            enqueue(sId, { role: 'user', content: 'Job 1' });
            enqueue(sId, { role: 'user', content: 'Job 2' });
            
            expect(queueSize(sId)).toBe(2);
            const first = dequeue(sId);
            expect(first?.message.content).toBe('Job 1');
            
            const session = runtime.createSession(sId, { model: 'm' });
            expect(session.getState()).toBe('idle');
        });

        it('models asynchronous dequeue lifecycle matching runtime state', async () => {
            const sId = 'auto_1';
            const s = runtime.createSession(sId, { model: 'm' });
            
            enqueue(sId, { role: 'user', content: 'QMsg' });
            expect(queueSize(sId)).toBe(1);

            // Simulation of a basic Turn Engine runner loop step
            const item = dequeue(sId);
            if (item && s.getState() === 'idle') {
                await s.chat(item.message.content as string);
            }

            expect(queueSize(sId)).toBe(0);
            const msgs = s.getMessages();
            expect(msgs[0].content).toBe('QMsg');
            expect(msgs[1].content).toBe('Processed: QMsg');
        });

        it('clears session maps natively when queues are cleared for hard resets', () => {
            enqueue('q_1', { role: 'user', content: 'a' });
            resetQueues();
            expect(queueSize('q_1')).toBe(0);
        });

        it('prevents double execution by checking session state', () => {
             const s = runtime.createSession('double_exec', { model: 'm' });
             enqueue('double_exec', { role: 'user', content: 'first' });
             
             // Directly manipulate state to simulate race condition
             (s as any).state = 'processing';
             
             // A realistic turn engine checks idle before dequeuing
             let processed = false;
             if (s.getState() === 'idle') {
                 dequeue('double_exec');
                 processed = true;
             }
             
             expect(processed).toBe(false);
             expect(queueSize('double_exec')).toBe(1); // item remains in queue
        });
    });
});
