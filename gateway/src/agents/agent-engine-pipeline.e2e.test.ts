/**
 * agents/agent-engine-pipeline.e2e.test.ts
 * E2E tests — full pipeline with mock providers.
 * Follows OpenClaw pi-embedded-runner.e2e.test.ts pattern.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
    createE2EEngine, createE2EWorkspace, cleanupE2EWorkspace,
    createScriptedProvider, createToolCallingProvider, createErrorProvider,
    createMaxTokensProvider, createStreamCollector, createOkProvider,
    type E2ETestWorkspace,
} from './test-helpers/e2e-fixtures.js';
import type { ToolCall } from './runtime.js';

let workspace: E2ETestWorkspace;

beforeAll(async () => { workspace = await createE2EWorkspace('e2e-pipeline-'); });
afterAll(async () => { await cleanupE2EWorkspace(workspace); });

// ─── Basic Turn Pipeline ─────────────────────────────────────────

describe('E2E: Basic Turn Pipeline', () => {
    it('runs a simple turn end-to-end', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const sessionId = engine.createSession({ systemPrompt: 'You are a test assistant.' });
        const result = await engine.runTurn(sessionId, 'Say ok');

        expect(result.responseText).toBe('ok');
        expect(result.turnNumber).toBe(1);
        expect(result.finishReason).toBe('end_turn');
        expect(result.usage.inputTokens).toBeGreaterThan(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
        engine.shutdown();
    });

    it('runs multi-turn conversation', async () => {
        const provider = createScriptedProvider({
            responses: [
                { content: 'Hello!' },
                { content: 'I remember you said hello.' },
                { content: 'This is turn 3.' },
            ],
        });
        const engine = createE2EEngine(provider, workspace.workspaceDir);
        const sid = engine.createSession();

        const r1 = await engine.runTurn(sid, 'Hello');
        expect(r1.responseText).toBe('Hello!');
        expect(r1.turnNumber).toBe(1);

        const r2 = await engine.runTurn(sid, 'Do you remember?');
        expect(r2.responseText).toBe('I remember you said hello.');
        expect(r2.turnNumber).toBe(2);

        const r3 = await engine.runTurn(sid, 'Continue');
        expect(r3.responseText).toBe('This is turn 3.');
        expect(r3.turnNumber).toBe(3);

        // Session should have all messages
        const session = engine.getSession(sid)!;
        expect(session.messages.length).toBeGreaterThanOrEqual(6); // 3 user + 3 assistant
        engine.shutdown();
    });

    it('handles system prompt injection', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const sid = engine.createSession({ systemPrompt: 'Always reply ok' });
        const session = engine.getSession(sid)!;
        expect(session.messages[0].role).toBe('system');
        expect(session.messages[0].content).toBe('Always reply ok');
        engine.shutdown();
    });
});

// ─── Tool Execution Pipeline ─────────────────────────────────────

describe('E2E: Tool Execution Pipeline', () => {
    it('executes tool call and continues', async () => {
        const toolCalls: ToolCall[] = [
            { id: 'tc_1', name: 'list_dir', arguments: JSON.stringify({ path: workspace.workspaceDir }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'Found the files.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        const result = await engine.runTurn(sid, 'List the workspace');

        expect(result.responseText).toBe('Found the files.');
        expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
        expect(result.toolCalls[0].name).toBe('list_dir');
        expect(result.toolCalls[0].output).toBeDefined();
        engine.shutdown();
    });

    it('executes read_file tool', async () => {
        // Create a test file
        const testFile = path.join(workspace.workspaceDir, 'hello.txt');
        await fs.writeFile(testFile, 'Hello World!', 'utf-8');

        const toolCalls: ToolCall[] = [
            { id: 'tc_read', name: 'read_file', arguments: JSON.stringify({ path: testFile }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'The file says Hello World.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        const result = await engine.runTurn(sid, 'Read the file');

        expect(result.toolCalls[0].output).toContain('Hello World!');
        expect(result.responseText).toBe('The file says Hello World.');
        engine.shutdown();
    });

    it('executes write_file tool', async () => {
        const targetFile = path.join(workspace.workspaceDir, 'output.txt');
        const toolCalls: ToolCall[] = [
            { id: 'tc_write', name: 'write_file', arguments: JSON.stringify({ path: targetFile, content: 'Written!' }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'File written.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        await engine.runTurn(sid, 'Write a file');

        const content = await fs.readFile(targetFile, 'utf-8');
        expect(content).toBe('Written!');
        engine.shutdown();
    });

    it('executes edit_file tool', async () => {
        const editFile = path.join(workspace.workspaceDir, 'edit-me.txt');
        await fs.writeFile(editFile, 'old content here', 'utf-8');

        const toolCalls: ToolCall[] = [
            { id: 'tc_edit', name: 'edit_file', arguments: JSON.stringify({ path: editFile, old_string: 'old content', new_string: 'new content' }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'Edited.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        await engine.runTurn(sid, 'Edit the file');

        const content = await fs.readFile(editFile, 'utf-8');
        expect(content).toBe('new content here');
        engine.shutdown();
    });

    it('handles unknown tool gracefully', async () => {
        const toolCalls: ToolCall[] = [
            { id: 'tc_bad', name: 'nonexistent_tool', arguments: '{}' },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'Handled error.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        const result = await engine.runTurn(sid, 'Use bad tool');

        expect(result.toolCalls[0].output).toContain('not found');
        expect(result.responseText).toBe('Handled error.');
        engine.shutdown();
    });

    it('handles tool execution error gracefully', async () => {
        const toolCalls: ToolCall[] = [
            { id: 'tc_err', name: 'read_file', arguments: JSON.stringify({ path: '/nonexistent/path/file.txt' }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'File not found, sorry.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        const result = await engine.runTurn(sid, 'Read missing file');

        expect(result.toolCalls[0].output).toContain('Error');
        expect(result.responseText).toBe('File not found, sorry.');
        engine.shutdown();
    });
});

// ─── Streaming Pipeline ──────────────────────────────────────────

describe('E2E: Streaming Pipeline', () => {
    it('delivers stream chunks to handler', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const sid = engine.createSession();
        const { handler, collected } = createStreamCollector();

        await engine.runTurn(sid, 'Stream test', handler);

        expect(collected.texts).toContain('ok');
        expect(collected.done).toBe(true);
        expect(collected.chunks.length).toBeGreaterThanOrEqual(2);
        engine.shutdown();
    });

    it('streams tool_use events', async () => {
        const toolCalls: ToolCall[] = [
            { id: 'tc_stream', name: 'list_dir', arguments: JSON.stringify({ path: workspace.workspaceDir }) },
        ];
        const engine = createE2EEngine(
            createToolCallingProvider(toolCalls, 'Listed.'),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        const { handler, collected } = createStreamCollector();

        await engine.runTurn(sid, 'List dir with stream', handler);

        expect(collected.toolUses).toContain('list_dir');
        expect(collected.done).toBe(true);
        engine.shutdown();
    });
});

// ─── Error Handling Pipeline ─────────────────────────────────────

describe('E2E: Error Handling', () => {
    it('throws on provider error', async () => {
        const engine = createE2EEngine(createErrorProvider('API rate limited'), workspace.workspaceDir);
        const sid = engine.createSession();

        await expect(engine.runTurn(sid, 'Hello')).rejects.toThrow('API rate limited');

        const session = engine.getSession(sid)!;
        expect(session.state).toBe('error');
        engine.shutdown();
    });

    it('reports max_tokens finish reason', async () => {
        const engine = createE2EEngine(createMaxTokensProvider(), workspace.workspaceDir);
        const sid = engine.createSession();
        const result = await engine.runTurn(sid, 'Write a long essay');

        expect(result.finishReason).toBe('max_tokens');
        expect(result.responseText).toBe('truncated...');
        engine.shutdown();
    });

    it('prevents concurrent turns on same session', async () => {
        const slow = createScriptedProvider({
            responses: [{ content: 'slow response' }],
        });
        // Override chat to be slow
        const originalChat = slow.chat;
        slow.chat = async (params) => {
            await new Promise(r => setTimeout(r, 100));
            return originalChat(params);
        };

        const engine = createE2EEngine(slow, workspace.workspaceDir);
        const sid = engine.createSession();

        const p1 = engine.runTurn(sid, 'First');
        // Second should fail because lock is held
        await expect(engine.runTurn(sid, 'Second')).rejects.toThrow('already running');
        await p1; // Let first complete
        engine.shutdown();
    });
});

// ─── Session Lifecycle ───────────────────────────────────────────

describe('E2E: Session Lifecycle', () => {
    it('creates and destroys sessions', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const s1 = engine.createSession();
        const s2 = engine.createSession();
        expect(engine.getSessionCount()).toBe(2);

        engine.destroySession(s1);
        expect(engine.getSessionCount()).toBe(1);
        expect(engine.getSession(s1)).toBeNull();
        expect(engine.getSession(s2)).not.toBeNull();
        engine.shutdown();
    });

    it('lists sessions with state', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        engine.createSession({ model: 'claude-3' });
        engine.createSession({ model: 'gpt-4o' });
        const list = engine.listSessions();

        expect(list).toHaveLength(2);
        expect(list.map(s => s.model)).toEqual(expect.arrayContaining(['claude-3', 'gpt-4o']));
        engine.shutdown();
    });

    it('shutdown aborts all sessions', async () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        engine.createSession();
        engine.createSession();
        engine.createSession();
        engine.shutdown();
        expect(engine.getSessionCount()).toBe(0);
    });

    it('tracks usage across turns', async () => {
        const engine = createE2EEngine(
            createScriptedProvider({ responses: [{ content: 'r1' }, { content: 'r2' }] }),
            workspace.workspaceDir,
        );
        const sid = engine.createSession();
        await engine.runTurn(sid, 'turn 1');
        await engine.runTurn(sid, 'turn 2');

        const session = engine.getSession(sid)!;
        expect(session.turnCount).toBe(2);
        expect(session.totalTokens).toBeGreaterThan(0);

        const tracker = engine.getUsageTracker();
        const summary = tracker.getSummary();
        expect(summary.turns).toBe(2);
        engine.shutdown();
    });
});

// ─── Tool Policy Pipeline ────────────────────────────────────────

describe('E2E: Tool Policy', () => {
    it('auto-approves read tools', () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const policy = engine.getToolPolicy();
        expect(policy.evaluate('read_file').decision).toBe('allow');
        expect(policy.evaluate('search').decision).toBe('allow');
        expect(policy.evaluate('list_dir').decision).toBe('allow');
        expect(policy.evaluate('glob').decision).toBe('allow');
        engine.shutdown();
    });

    it('requires approval for write/exec tools', () => {
        const engine = createE2EEngine(createOkProvider(), workspace.workspaceDir);
        const policy = engine.getToolPolicy();
        expect(policy.evaluate('bash').decision).toBe('require_approval');
        expect(policy.evaluate('write_file').decision).toBe('require_approval');
        expect(policy.evaluate('edit_file').decision).toBe('require_approval');
        engine.shutdown();
    });
});
