// @ts-nocheck
/**
 * agents/test-helpers/e2e-fixtures.ts
 * E2E test fixtures for AgentEngine — full pipeline with mock providers.
 * Follows CoreBlow's pi-embedded-runner-e2e-fixtures.ts pattern.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AgentEngine, type EngineSession } from '../agent-engine.js';
import { registerBuiltinTools } from '../tool-definitions.js';
import { AgentStreamBridge } from '../agent-stream-bridge.js';
import type { ModelProvider, ToolCall, TokenUsage } from '../runtime.js';
import type { StreamChunk, StreamHandler } from '../provider-stream.js';

// ─── Test Workspace ──────────────────────────────────────────────

export interface E2ETestWorkspace {
    tempRoot: string;
    agentDir: string;
    workspaceDir: string;
}

export async function createE2EWorkspace(prefix: string = 'coreblow-e2e-'): Promise<E2ETestWorkspace> {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
    const agentDir = path.join(tempRoot, 'agent');
    const workspaceDir = path.join(tempRoot, 'workspace');
    await fs.mkdir(agentDir, { recursive: true });
    await fs.mkdir(workspaceDir, { recursive: true });
    return { tempRoot, agentDir, workspaceDir };
}

export async function cleanupE2EWorkspace(ws: E2ETestWorkspace | undefined): Promise<void> {
    if (!ws) return;
    await fs.rm(ws.tempRoot, { recursive: true, force: true });
}

// ─── Mock Providers ──────────────────────────────────────────────

export function createMockUsage(input: number = 100, output: number = 50): TokenUsage {
    return { input, output, total: input + output };
}

export interface MockProviderScenario {
    responses: Array<{
        content: string;
        toolCalls?: ToolCall[];
        usage?: TokenUsage;
        finishReason?: string;
    }>;
}

/**
 * Create a mock provider that returns scripted responses.
 * Follows CoreBlow's buildAssistantMessage pattern.
 */
export function createScriptedProvider(scenario: MockProviderScenario): ModelProvider {
    let callIndex = 0;
    return {
        id: 'mock-e2e',
        name: 'Mock E2E Provider',
        chat: async (params) => {
            const response = scenario.responses[callIndex] ?? {
                content: `[fallback response ${callIndex}]`,
                usage: createMockUsage(),
                finishReason: 'end_turn',
            };
            callIndex++;
            return {
                content: response.content,
                toolCalls: response.toolCalls,
                usage: response.usage ?? createMockUsage(),
                finishReason: response.finishReason ?? 'end_turn',
            };
        },
    };
}

/**
 * Create a provider that always responds "ok".
 * Equivalent to CoreBlow's LIVE_OK_PROMPT pattern.
 */
export function createOkProvider(): ModelProvider {
    return createScriptedProvider({
        responses: [{ content: 'ok', usage: createMockUsage(10, 1) }],
    });
}

/**
 * Create a provider that triggers tool calls then responds.
 */
export function createToolCallingProvider(toolCalls: ToolCall[], finalResponse: string = 'Done.'): ModelProvider {
    return createScriptedProvider({
        responses: [
            { content: '', toolCalls, usage: createMockUsage(200, 100) },
            { content: finalResponse, usage: createMockUsage(150, 50) },
        ],
    });
}

/**
 * Create a provider that simulates an error.
 */
export function createErrorProvider(errorMessage: string = 'Provider error'): ModelProvider {
    return {
        id: 'mock-error',
        name: 'Mock Error Provider',
        chat: async () => { throw new Error(errorMessage); },
    };
}

/**
 * Create a provider that returns max_tokens finish reason.
 */
export function createMaxTokensProvider(): ModelProvider {
    return createScriptedProvider({
        responses: [{ content: 'truncated...', usage: createMockUsage(200, 4096), finishReason: 'max_tokens' }],
    });
}

// ─── Engine Factories ────────────────────────────────────────────

/**
 * Create a fully wired AgentEngine with mock provider and built-in tools.
 */
export function createE2EEngine(provider?: ModelProvider, sandboxDir?: string): AgentEngine {
    const engine = new AgentEngine({
        sandboxBaseDir: sandboxDir ?? os.tmpdir(),
        enableStreaming: true,
        enableCompaction: true,
        enableToolLoopDetection: true,
    });
    engine.registerProvider(provider ?? createOkProvider(), true);
    registerBuiltinTools(engine);
    return engine;
}

/**
 * Create engine + stream bridge.
 */
export function createE2EEngineWithBridge(provider?: ModelProvider): { engine: AgentEngine; bridge: AgentStreamBridge } {
    const engine = createE2EEngine(provider);
    const bridge = new AgentStreamBridge();
    return { engine, bridge };
}

// ─── Stream Collector ────────────────────────────────────────────

export interface CollectedStream {
    chunks: StreamChunk[];
    texts: string[];
    toolUses: string[];
    errors: string[];
    done: boolean;
}

export function createStreamCollector(): { handler: StreamHandler; collected: CollectedStream } {
    const collected: CollectedStream = { chunks: [], texts: [], toolUses: [], errors: [], done: false };
    const handler: StreamHandler = (chunk: StreamChunk) => {
        collected.chunks.push(chunk);
        if (chunk.type === 'text') collected.texts.push(chunk.content ?? '');
        if (chunk.type === 'tool_use') collected.toolUses.push(chunk.toolUse?.name ?? '');
        if (chunk.type === 'error') collected.errors.push(chunk.content ?? '');
        if (chunk.type === 'done') collected.done = true;
    };
    return { handler, collected };
}

// ─── Live Test Helpers ───────────────────────────────────────────

export const LIVE_OK_PROMPT = 'Reply with the word ok.';

export function isLiveTestEnabled(extraEnvVars: string[] = []): boolean {
    return [...extraEnvVars, 'LIVE', 'COREBLOW_LIVE_TEST'].some(
        name => ['1', 'true', 'yes'].includes((process.env[name] ?? '').toLowerCase()),
    );
}
