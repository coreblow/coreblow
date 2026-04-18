/**
 * agents/wave5-batch.test.ts
 * Batch tests for Wave 5 agent modules.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// defaults
import { DEFAULT_CONTEXT_TOKENS, DEFAULT_MODEL_ID, DEFAULT_PROVIDER } from './defaults.js';

// stable-stringify
import { stableStringify } from './stable-stringify.js';

// timeout
import { withTimeout, sleep, createDeadline } from './timeout.js';

// session-slug
import { createSessionSlug } from './session-slug.js';

// session-dirs
import { resolveSessionDir, resolveTranscriptPath, listSessions } from './session-dirs.js';

// shell-utils
import { escapeShellArg, splitShellCommand, isUnsafeCommand, buildShellExec, sanitizeEnvVars } from './shell-utils.js';

// usage
import { UsageTracker } from './usage.js';

// tool-call-id
import { generateToolCallId, isValidToolCallId } from './tool-call-id.js';

// tool-catalog
import { ToolCatalog } from './tool-catalog.js';

// tool-policy
import { ToolPolicy, isDangerousTool } from './tool-policy.js';

// tool-mutation
import { MutationTracker } from './tool-mutation.js';

// provider-capabilities
import { getProviderCapabilities, supportsFeature, listSupportedProviders } from './provider-capabilities.js';

// models-config
import { mergeModelConfigs, resolveModelConfig, validateModelsConfig } from './models-config.js';

// identity
import { resolveIdentity, formatIdentityPrompt, formatIdentityBadge } from './identity.js';

// subagent-depth
import { createDepthContext, canSpawnSubagent, incrementDepth, isAtMaxDepth } from './subagent-depth.js';

// sandbox
import { Sandbox, createDefaultSandbox } from './sandbox.js';

// sandbox-paths
import { isPathTraversal, ensureWithinBase } from './sandbox-paths.js';

// context-cache
import { ContextCache } from './context-cache.js';

// context-window-guard
import { ContextWindowGuard } from './context-window-guard.js';

// glob-pattern
import { globMatch, globMatchAny } from './glob-pattern.js';

// internal-events
import { InternalEventBus } from './internal-events.js';

// lanes
import { LaneManager } from './lanes.js';

// image-sanitization
import { isAllowedImageType, validateImageInput, inferMimeType } from './image-sanitization.js';

// payload-redaction
import { redactPayload, redactHeaders, redactUrl } from './payload-redaction.js';

// configured-provider-fallback
import { resolveProviderChain, nextProvider } from './configured-provider-fallback.js';

// ─── Tests ────────────────────────────────────────────────────────

describe('defaults', () => {
    it('exports constants', () => { expect(DEFAULT_CONTEXT_TOKENS).toBe(128_000); expect(DEFAULT_MODEL_ID).toBeTruthy(); expect(DEFAULT_PROVIDER).toBe('anthropic'); });
});

describe('stableStringify', () => {
    it('sorts keys', () => { expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 })); });
    it('handles arrays', () => { expect(stableStringify([1, 2])).toBe('[1,2]'); });
    it('handles null', () => { expect(stableStringify(null)).toBe('null'); });
    it('handles nested', () => { expect(stableStringify({ a: { c: 1, b: 2 } })).toContain('"b":2'); });
});

describe('timeout', () => {
    it('withTimeout resolves', async () => { const r = await withTimeout(Promise.resolve(42), 1000); expect(r).toBe(42); });
    it('withTimeout rejects on timeout', async () => { await expect(withTimeout(new Promise(() => {}), 10, 'test')).rejects.toThrow('Timeout'); });
    it('sleep resolves', async () => { await sleep(10); });
    it('createDeadline', () => { const d = createDeadline(100); expect(d.isExpired()).toBe(false); expect(d.remainingMs()).toBeGreaterThan(0); });
});

describe('session-slug', () => {
    it('generates unique slugs', () => { expect(createSessionSlug()).not.toBe(createSessionSlug()); });
    it('respects isTaken', () => {
        const taken = new Set<string>();
        const first = createSessionSlug((id) => { taken.add(id); return false; });
        expect(first).toBeTruthy();
    });
});

describe('session-dirs', () => {
    it('resolves session dir', () => { expect(resolveSessionDir('/a', 's1')).toContain('sessions/s1'); });
    it('resolves transcript', () => { expect(resolveTranscriptPath('/a', 's1')).toContain('transcript.jsonl'); });
    it('lists sessions for missing dir', () => { expect(listSessions('/tmp/nonexistent-xyz')).toEqual([]); });
});

describe('shell-utils', () => {
    it('escapes args', () => { expect(escapeShellArg("it's")).toBe("'it'\\''s'"); });
    it('splits commands', () => { const { program, args } = splitShellCommand('echo hello world'); expect(program).toBe('echo'); expect(args).toEqual(['hello', 'world']); });
    it('detects unsafe', () => { expect(isUnsafeCommand('rm -rf /').unsafe).toBe(true); expect(isUnsafeCommand('echo hello').unsafe).toBe(false); });
    it('builds shell exec', () => { const { cmd, args } = buildShellExec('ls -la'); expect(args).toContain('ls -la'); });
    it('sanitizes env', () => { expect(sanitizeEnvVars({ A: '1', B: '2' }, ['A'])).toEqual({ A: '1' }); });
});

describe('UsageTracker', () => {
    it('tracks usage', () => { const u = new UsageTracker(); u.record({ inputTokens: 100, outputTokens: 50 }); const s = u.getSummary(); expect(s.totalInputTokens).toBe(100); expect(s.turns).toBe(1); });
    it('formats', () => { const u = new UsageTracker(); u.record({ inputTokens: 1000, outputTokens: 500, cost: 0.05 }); expect(u.format()).toContain('1,500'); });
});

describe('tool-call-id', () => {
    it('generates unique', () => { expect(generateToolCallId()).not.toBe(generateToolCallId()); });
    it('validates', () => { expect(isValidToolCallId('toolu_abc')).toBe(true); expect(isValidToolCallId('')).toBe(false); });
});

describe('ToolCatalog', () => {
    it('register and list', () => { const c = new ToolCatalog(); c.register({ name: 'read', description: 'Read file', category: 'file' }); expect(c.size()).toBe(1); expect(c.list()).toHaveLength(1); });
    it('filter by category', () => { const c = new ToolCatalog(); c.register({ name: 'r', description: 'd', category: 'file' }); c.register({ name: 'e', description: 'd', category: 'exec' }); expect(c.listByCategory('file')).toHaveLength(1); });
    it('enable/disable', () => { const c = new ToolCatalog(); c.register({ name: 'r', description: 'd', category: 'file' }); c.setEnabled('r', false); expect(c.listEnabled()).toHaveLength(0); });
    it('buildToolPrompt', () => { const c = new ToolCatalog(); c.register({ name: 'read', description: 'Read a file', category: 'file' }); expect(c.buildToolPrompt()).toContain('read'); });
});

describe('ToolPolicy', () => {
    it('default allow', () => { const p = new ToolPolicy(); expect(p.evaluate('anything').decision).toBe('allow'); });
    it('deny rule', () => { const p = new ToolPolicy([{ toolPattern: 'rm*', decision: 'deny', reason: 'dangerous' }]); expect(p.evaluate('rm_file').decision).toBe('deny'); });
    it('approval rule', () => { const p = new ToolPolicy([{ toolPattern: 'exec', decision: 'require_approval' }]); expect(p.evaluate('exec').decision).toBe('require_approval'); });
    it('isDangerousTool', () => { expect(isDangerousTool('rm')).toBe(true); expect(isDangerousTool('read')).toBe(false); });
});

describe('MutationTracker', () => {
    it('records and retrieves', () => { const t = new MutationTracker(); t.record({ toolName: 'write', type: 'create', target: '/file', reversible: true }); expect(t.count()).toBe(1); expect(t.getReversible()).toHaveLength(1); });
    it('formats', () => { const t = new MutationTracker(); t.record({ toolName: 'write', type: 'create', target: '/f', reversible: true }); expect(t.format()).toContain('write'); });
});

describe('provider-capabilities', () => {
    it('gets openai caps', () => { const c = getProviderCapabilities('openai'); expect(c.supportsTools).toBe(true); expect(c.supportsVision).toBe(true); });
    it('supportsFeature', () => { expect(supportsFeature('anthropic', 'supportsCaching')).toBe(true); });
    it('lists providers', () => { expect(listSupportedProviders()).toContain('openai'); });
});

describe('models-config', () => {
    it('merges configs', () => {
        const base = { default: 'a', models: { a: { id: 'a', provider: 'openai' } } };
        const merged = mergeModelConfigs(base, { default: 'b', models: { b: { id: 'b', provider: 'anthropic' } } });
        expect(merged.default).toBe('b');
        expect(merged.models.a).toBeDefined();
        expect(merged.models.b).toBeDefined();
    });
    it('resolves model', () => {
        const cfg = { default: 'a', models: { a: { id: 'a', provider: 'openai' } } };
        expect(resolveModelConfig(cfg, 'a')!.provider).toBe('openai');
    });
    it('validates', () => {
        const r = validateModelsConfig({ default: 'missing', models: { a: { id: 'a', provider: '' } } });
        expect(r.valid).toBe(false);
        expect(r.errors.length).toBeGreaterThan(0);
    });
});

describe('identity', () => {
    it('resolves defaults', () => { const id = resolveIdentity(); expect(id.name).toBe('CoreBlow'); });
    it('overrides', () => { expect(resolveIdentity({ name: 'Bot' }).name).toBe('Bot'); });
    it('formats prompt', () => { expect(formatIdentityPrompt(resolveIdentity())).toContain('CoreBlow'); });
    it('formats badge', () => { expect(formatIdentityBadge(resolveIdentity())).toContain('CoreBlow'); });
});

describe('subagent-depth', () => {
    it('starts at 0', () => { expect(createDepthContext().current).toBe(0); });
    it('can spawn at 0', () => { expect(canSpawnSubagent(createDepthContext())).toBe(true); });
    it('increments', () => { const ctx = incrementDepth(createDepthContext(2), 'a'); expect(ctx.current).toBe(1); });
    it('blocks at max', () => { const ctx = incrementDepth(incrementDepth(createDepthContext(2), 'a'), 'b'); expect(isAtMaxDepth(ctx)).toBe(true); expect(canSpawnSubagent(ctx)).toBe(false); });
});

describe('Sandbox', () => {
    it('allows within dir', () => { const s = createDefaultSandbox('/tmp/ws'); expect(s.isPathAllowed('/tmp/ws/file.ts').allowed).toBe(true); });
    it('denies outside', () => { const s = createDefaultSandbox('/tmp/ws'); expect(s.isPathAllowed('/etc/passwd').allowed).toBe(false); });
    it('denies .env', () => { const s = createDefaultSandbox('/tmp/ws'); expect(s.isPathAllowed('/tmp/ws/.env').allowed).toBe(false); });
});

describe('sandbox-paths', () => {
    it('detects traversal', () => { expect(isPathTraversal('../etc')).toBe(true); expect(isPathTraversal('file.ts')).toBe(false); });
    it('validates within base', () => { expect(ensureWithinBase('src/a.ts', '/tmp/ws').valid).toBe(true); expect(ensureWithinBase('../../etc/passwd', '/tmp/ws').valid).toBe(false); });
});

describe('ContextCache', () => {
    it('set/get', () => { const c = new ContextCache(); c.set('k', { key: 'k', hash: 'h', tokens: 100, createdAt: Date.now(), expiresAt: Date.now() + 60000, provider: 'p', model: 'm' }); expect(c.get('k')!.tokens).toBe(100); });
    it('expires', () => { const c = new ContextCache(); c.set('k', { key: 'k', hash: 'h', tokens: 1, createdAt: 0, expiresAt: 0, provider: 'p', model: 'm' }); expect(c.get('k')).toBeUndefined(); });
});

describe('ContextWindowGuard', () => {
    it('tracks usage', () => { const g = new ContextWindowGuard({ contextWindow: 1000 }); g.add(500); expect(g.remaining).toBeGreaterThan(0); expect(g.isExceeded).toBe(false); });
    it('detects exceeded', () => { const g = new ContextWindowGuard({ contextWindow: 100 }); g.add(500); expect(g.isExceeded).toBe(true); });
    it('formatStatus', () => { const g = new ContextWindowGuard({ contextWindow: 1000 }); expect(g.formatStatus()).toContain('🟢'); });
});

describe('glob-pattern', () => {
    it('exact match', () => { expect(globMatch('foo', 'foo')).toBe(true); expect(globMatch('foo', 'bar')).toBe(false); });
    it('wildcard', () => { expect(globMatch('*.ts', 'file.ts')).toBe(true); expect(globMatch('*.ts', 'file.js')).toBe(false); });
    it('double star', () => { expect(globMatch('**/*.ts', 'src/deep/file.ts')).toBe(true); });
    it('globMatchAny', () => { expect(globMatchAny(['*.ts', '*.js'], 'file.js')).toBe(true); });
});

describe('InternalEventBus', () => {
    it('on/emit', async () => { const bus = new InternalEventBus(); let val = 0; bus.on('test', (d: number) => { val = d; }); await bus.emit('test', 42); expect(val).toBe(42); });
    it('once', async () => { const bus = new InternalEventBus(); let count = 0; bus.once('e', () => { count++; }); await bus.emit('e', null); await bus.emit('e', null); expect(count).toBe(1); });
    it('off', () => { const bus = new InternalEventBus(); bus.on('e', () => {}); bus.off('e'); expect(bus.listenerCount('e')).toBe(0); });
});

describe('LaneManager', () => {
    it('acquires and releases', () => { const m = new LaneManager(2); const l = m.acquire('a', 'task'); expect(l).not.toBeNull(); m.release(l!.id); expect(m.busyCount()).toBe(0); });
    it('blocks at max', () => { const m = new LaneManager(1); m.acquire('a'); expect(m.acquire('b')).toBeNull(); });
    it('slots', () => { const m = new LaneManager(3); m.acquire('a'); expect(m.availableSlots()).toBe(2); });
});

describe('image-sanitization', () => {
    it('allowed types', () => { expect(isAllowedImageType('image/png')).toBe(true); expect(isAllowedImageType('video/mp4')).toBe(false); });
    it('validates input', () => { expect(validateImageInput({ mimeType: 'image/png', sizeBytes: 1000 }).valid).toBe(true); });
    it('infers mime', () => { expect(inferMimeType('photo.jpg')).toBe('image/jpeg'); expect(inferMimeType('doc.pdf')).toBeNull(); });
});

describe('payload-redaction', () => {
    it('redacts keys', () => { const r = redactPayload({ api_key: 'secret', name: 'test' }) as Record<string, unknown>; expect(r.api_key).toBe('[REDACTED]'); expect(r.name).toBe('test'); });
    it('redacts headers', () => { expect(redactHeaders({ authorization: 'Bearer x', 'content-type': 'json' }).authorization).toBe('[REDACTED]'); });
    it('redacts url', () => { expect(redactUrl('https://api.com?key=secret')).toContain('***'); });
});

describe('configured-provider-fallback', () => {
    it('resolves chain', () => { const c = resolveProviderChain({ primary: 'openai', fallbacks: ['anthropic', 'google'] }); expect(c).toEqual(['openai', 'anthropic', 'google']); });
    it('next provider', () => { expect(nextProvider(['openai', 'anthropic'], 'openai')).toBe('anthropic'); expect(nextProvider(['openai'], 'openai')).toBeNull(); });
});
