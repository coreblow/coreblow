/**
 * agents/wave6-pi-runtime.test.ts
 * Batch tests for PI embedded, tools, and runtime modules.
 */
import { describe, it, expect } from 'vitest';

// PI Embedded
import { createPiEmbeddedConfig } from './pi-embedded.js';
import { createRunnerState, incrementTurn } from './pi-embedded-runner.js';
import { truncateContent } from './pi-embedded-helpers.js';
import { safeJsonParse, generateRequestId } from './pi-embedded-utils.js';
import { createMessage } from './pi-embedded-messaging.js';
import { buildPayload } from './pi-embedded-payloads.js';
import { chunkBlocks } from './pi-embedded-block-chunker.js';
import { createErrorObservation } from './pi-embedded-error-observation.js';
import { MessageQueue } from './pi-embedded-queue.runtime.js';

// PI Subscribe
import { createSubscription } from './pi-embedded-subscribe.js';
import { createHandlerResult } from './pi-embedded-subscribe.handlers.types.js';
import { handleTextDelta, handleMessageComplete } from './pi-embedded-subscribe.handlers.messages.js';
import { handleToolUseStart } from './pi-embedded-subscribe.handlers.tools.js';
import { shouldExecuteTool } from './pi-embedded-subscribe.tools.js';
import { parseSSELine } from './pi-embedded-subscribe.raw-stream.js';
import { createTestMessages } from './pi-embedded-subscribe.compaction-test-helpers.js';

// PI Auth
import { isCredentialValid, createCredential } from './pi-auth-credentials.js';
import { serializeAuth, deserializeAuth } from './pi-auth-json.js';

// PI Tools
import { extractParam, requireParam } from './pi-tools.params.js';
import { buildToolSchema } from './pi-tools.schema.js';
import { createAutoApproveHook } from './pi-tools.before-tool-call.js';
import { createAbortController } from './pi-tools.abort.js';
import { validateEdit } from './pi-tools.host-edit.js';
import { anthropicToOpenAI } from './pi-tool-definition-adapter.js';

// PI Settings
import { DEFAULT_PI_SETTINGS } from './pi-settings.js';
import { detectProjectSettings } from './pi-project-settings.js';

// PI Model Discovery
import { discoverModels } from './pi-model-discovery.js';

// ─── Tests ────────────────────────────────────────────────────────

describe('PI Embedded', () => {
    it('creates config', () => { const c = createPiEmbeddedConfig('claude-3', 'anthropic', 'sk-test'); expect(c.model).toBe('claude-3'); expect(c.maxTurns).toBe(50); });
    it('runner state', () => { const s = createRunnerState(); incrementTurn(s); expect(s.turnCount).toBe(1); });
    it('truncates content', () => { expect(truncateContent('hi', 100)).toBe('hi'); expect(truncateContent('x'.repeat(200), 50)).toContain('[truncated]'); });
    it('safe JSON parse', () => { expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 }); expect(safeJsonParse('bad', 42)).toBe(42); });
    it('generates request ID', () => { expect(generateRequestId()).toMatch(/^req_/); });
    it('creates message', () => { const m = createMessage('user', 'hello'); expect(m.role).toBe('user'); expect(m.timestamp).toBeGreaterThan(0); });
    it('builds payload', () => { const p = buildPayload('claude-3', [{ role: 'user', content: 'hi' }], 1000); expect(p.model).toBe('claude-3'); expect(p.max_tokens).toBe(1000); });
    it('chunks blocks', () => { const chunks = chunkBlocks([1, 2, 3, 4, 5], 2); expect(chunks).toHaveLength(3); expect(chunks[0]).toEqual([1, 2]); });
    it('creates error observation', () => { const e = createErrorObservation('fail', 'openai', 'gpt-4o', true); expect(e.retryable).toBe(true); });
});

describe('MessageQueue', () => {
    it('enqueue/dequeue', () => { const q = new MessageQueue<number>(); q.enqueue(1); q.enqueue(2); expect(q.dequeue()).toBe(1); expect(q.size()).toBe(1); });
    it('isEmpty', () => { const q = new MessageQueue(); expect(q.isEmpty()).toBe(true); q.enqueue('x'); expect(q.isEmpty()).toBe(false); });
    it('clear', () => { const q = new MessageQueue(); q.enqueue(1); q.clear(); expect(q.size()).toBe(0); });
});

describe('PI Subscribe', () => {
    it('creates subscription', () => { const s = createSubscription(['message', 'done'], () => {}); expect(s.id).toMatch(/^sub_/); expect(s.events).toHaveLength(2); });
    it('handler result', () => { expect(createHandlerResult(true).shouldContinue).toBe(true); });
    it('text delta', () => { expect(handleTextDelta('hello')).toBe('hello'); });
    it('message complete', () => { const r = handleMessageComplete('done'); expect(r.role).toBe('assistant'); });
    it('tool use start', () => { const r = handleToolUseStart('bash', 'id1'); expect(r.name).toBe('bash'); });
    it('should execute tool', () => { expect(shouldExecuteTool('bash', ['bash', 'read'])).toBe(true); expect(shouldExecuteTool('write', ['bash'])).toBe(false); });
    it('parse SSE line', () => { expect(parseSSELine('data: hello')).toEqual({ data: 'hello' }); expect(parseSSELine('event: done')).toEqual({ event: 'done' }); expect(parseSSELine('')).toBeNull(); });
    it('test messages', () => { const msgs = createTestMessages(4); expect(msgs).toHaveLength(4); expect(msgs[0].role).toBe('user'); expect(msgs[1].role).toBe('assistant'); });
});

describe('PI Auth', () => {
    it('creates credential', () => { const c = createCredential('openai', 'sk-test'); expect(isCredentialValid(c)).toBe(true); });
    it('expired credential', () => { expect(isCredentialValid({ provider: 'x', token: 'y', expiresAt: 0 })).toBe(false); });
    it('serialize/deserialize', () => { const data = { key: 'value' }; expect(deserializeAuth(serializeAuth(data))).toEqual(data); });
    it('bad JSON', () => { expect(deserializeAuth('bad')).toBeNull(); });
});

describe('PI Tools', () => {
    it('extract param', () => { expect(extractParam({ a: 1 }, 'a', 0)).toBe(1); expect(extractParam({}, 'b', 42)).toBe(42); });
    it('require param throws', () => { expect(() => requireParam({}, 'x')).toThrow('Missing'); });
    it('build schema', () => { const s = buildToolSchema('test', 'desc', { arg: { type: 'string' } }); expect(s.name).toBe('test'); });
    it('auto approve hook', () => { const hook = createAutoApproveHook(['bash', 'read']); expect(hook('bash', {}).proceed).toBe(true); expect(hook('write', {}).proceed).toBe(false); });
    it('abort controller', () => { const { controller, cleanup } = createAbortController(); expect(controller.signal.aborted).toBe(false); cleanup(); });
    it('validate edit', () => { expect(validateEdit({ filePath: '', oldContent: '', newContent: '' }).valid).toBe(false); expect(validateEdit({ filePath: '/a', oldContent: 'x', newContent: 'y' }).valid).toBe(true); });
    it('anthropic to openai', () => { const r = anthropicToOpenAI({ name: 'test', description: 'd', input_schema: {} }); expect(r.type).toBe('function'); expect(r.function.name).toBe('test'); });
});

describe('PI Settings', () => {
    it('default settings', () => { expect(DEFAULT_PI_SETTINGS.autoApprove).toBe(false); expect(DEFAULT_PI_SETTINGS.maxTurns).toBe(50); });
    it('detect project', () => { const s = detectProjectSettings(['tsconfig.json', 'vitest.config.ts']); expect(s.language).toBe('typescript'); expect(s.testRunner).toBe('vitest'); });
});

describe('PI Model Discovery', () => {
    it('returns empty by default', async () => { expect(await discoverModels('test', 'key')).toEqual([]); });
});
