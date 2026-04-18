/**
 * agents/wave7-remaining.test.ts
 * Tests for remaining Wave 5-7 modules: CLI, bash-tools extensions, subagent extensions, model-auth, skills, misc.
 */
import { describe, it, expect } from 'vitest';

// CLI
import { formatHeader, formatSection, formatProgress, formatDuration, formatBytes, colorize } from './cli-output.js';
import { resolveCliBackend, getCliBackendLabel } from './cli-backends.js';
import { createCliRunnerConfig } from './cli-runner.js';
import { createCliSession } from './cli-session.js';
import { CLI_WATCHDOG_TIMEOUT_MS } from './cli-watchdog-defaults.js';

// Bash-tools extensions
import { createExecRequest } from './bash-tools.exec-types.js';
import { shouldAutoApprove, DEFAULT_AUTO_APPROVE_PATTERNS } from './bash-tools.exec-approval-followup.js';
import { DEFAULT_EXEC_HOST_CONFIG, mergeExecHostConfig } from './bash-tools.exec-host-shared.js';
import { detectRuntime } from './bash-tools.exec-runtime.js';

// Model auth
import { resolveApiKeyFromEnv } from './model-auth-env.js';
import { getAuthEnvVar } from './model-auth-env-vars.js';
import { redactApiKey } from './model-auth-label.js';
import { getAuthMarkerIcon } from './model-auth-markers.js';
import { isApiKeyValid } from './model-auth-runtime-shared.js';
import { parseModelAlias } from './model-alias-lines.js';
import { isModelAllowed, isModelBlocked } from './model-allowlist-ref.js';
import { parseModelRef } from './model-ref-profile.js';
import { createModelPlan } from './models-config.plan.js';
import { inferProvider } from './models-config.providers.implicit.js';
import { DEFAULT_PROVIDER_POLICY } from './models-config.providers.policy.js';
import { STATIC_PROVIDERS } from './models-config.providers.static.js';

// Subagent extensions
import { announceSubagent, formatAnnouncement, clearAnnouncements } from './subagent-announce.js';
import { enqueueAnnouncement, drainQueue, queueSize } from './subagent-announce-queue.js';
import { createCapabilitySet, hasCapability } from './subagent-capabilities.js';
import { recordLifecycleEvent, clearLifecycleLog } from './subagent-lifecycle-events.js';
import { detectOrphans } from './subagent-orphan-recovery.js';
import { createAttachment, totalAttachmentSize } from './subagent-attachments.js';
import { generateRegistryKey, parseRegistryKey } from './subagent-registry-helpers.js';
import { validateTransition } from './subagent-registry-lifecycle.js';
import { RunManager } from './subagent-registry-run-manager.js';
import { resolveRegistryState } from './subagent-registry-state.js';
import { recordCompletion, clearCompletions } from './subagent-registry-completion.js';

// Session/Tool result
import { guardToolResult } from './session-tool-result-guard.js';
import { repairJsonl } from './session-file-repair.js';

// Skills
import { buildClawHubUrl } from './skills-clawhub.js';
import { formatInstallResult } from './skills-install.js';
import { formatSkillStatus } from './skills-status.js';

// Trace
import { createSpan, endSpan, spanDurationMs } from './trace-base.js';

// Misc
import { formatBtw, shouldShowBtw } from './btw.js';
import { resolveDocsPath } from './docs-path.js';
import { formatOwner } from './owner-display.js';
import { resolveAvatar } from './identity-avatar.js';
import { formatAttribution } from './provider-attribution.js';
import { resolveClaudeCliConfig } from './claude-cli-runner.js';
import { COREBLOW_TOOLS, isCoreBlowTool } from './coreblow-tools.js';
import { OLLAMA_DEFAULT_URL } from './self-hosted-provider-defaults.js';
import { isMediaPath } from './sandbox-media-paths.js';
import { detectTemplate } from './workspace-templates.js';
import { maskKey } from './live-auth-keys.js';
import { classifyFailoverError, isRetryableError } from './failover-error.js';
import { createSpawnedContext } from './spawned-context.js';
import { logAnthropicPayload, extractAnthropicUsage } from './anthropic-payload-log.js';
import { createMockResponse } from './live-test-helpers.js';
import { getKeySequence } from './pty-keys.js';
import { searchMessages } from './memory-search.js';
import { generatePromptReport } from './system-prompt-report.js';

// ─── Tests ─────────────────────────────────────────────────────

describe('CLI output', () => {
    it('formatHeader', () => { expect(formatHeader('Test')).toContain('Test'); });
    it('formatSection', () => { expect(formatSection('Title', 'body')).toContain('Title'); });
    it('formatProgress', () => { expect(formatProgress(50, 100)).toContain('50%'); });
    it('formatDuration', () => { expect(formatDuration(500)).toBe('500ms'); expect(formatDuration(5000)).toBe('5.0s'); expect(formatDuration(90_000)).toContain('m'); });
    it('formatBytes', () => { expect(formatBytes(500)).toBe('500B'); expect(formatBytes(2048)).toBe('2.0KB'); });
    it('colorize', () => { expect(colorize('text', 'red')).toContain('\x1b[31m'); });
    it('resolveCliBackend', () => { expect(resolveCliBackend('openai')).toBe('openai'); expect(resolveCliBackend()).toBe('anthropic'); });
    it('getCliBackendLabel', () => { expect(getCliBackendLabel('anthropic')).toContain('Claude'); });
    it('createCliRunnerConfig', () => { expect(createCliRunnerConfig().interactive).toBe(true); });
    it('createCliSession', () => { const s = createCliSession('claude-3', 'anthropic'); expect(s.id).toMatch(/^cli_/); });
    it('watchdog timeout', () => { expect(CLI_WATCHDOG_TIMEOUT_MS).toBeGreaterThan(0); });
});

describe('Bash-tools extensions', () => {
    it('createExecRequest', () => { const r = createExecRequest('ls -la'); expect(r.command).toBe('ls -la'); expect(r.riskLevel).toBe('safe'); });
    it('shouldAutoApprove', () => { expect(shouldAutoApprove('echo hello', DEFAULT_AUTO_APPROVE_PATTERNS)).toBe(true); expect(shouldAutoApprove('rm -rf /', DEFAULT_AUTO_APPROVE_PATTERNS)).toBe(false); });
    it('mergeExecHostConfig', () => { const m = mergeExecHostConfig(DEFAULT_EXEC_HOST_CONFIG, { timeout: 5000 }); expect(m.timeout).toBe(5000); });
    it('detectRuntime', () => { expect(['node', 'bun', 'deno', 'unknown']).toContain(detectRuntime()); });
});

describe('Model auth', () => {
    it('getAuthEnvVar', () => { expect(getAuthEnvVar('openai')).toBe('OPENAI_API_KEY'); });
    it('redactApiKey', () => { expect(redactApiKey('sk-1234567890')).toBe('sk-1…7890'); });
    it('getAuthMarkerIcon', () => { expect(getAuthMarkerIcon('valid')).toBe('✅'); });
    it('isApiKeyValid', () => { expect(isApiKeyValid('sk-12345678901')).toBe(true); expect(isApiKeyValid('')).toBe(false); });
    it('parseModelAlias', () => { expect(parseModelAlias('fast = gpt-4o-mini')).toEqual({ alias: 'fast', target: 'gpt-4o-mini' }); expect(parseModelAlias('bad line')).toBeNull(); });
    it('model allowlist', () => { expect(isModelAllowed('gpt-4o', ['gpt-4o'])).toBe(true); expect(isModelAllowed('gpt-4o', ['claude-3'])).toBe(false); expect(isModelAllowed('any')).toBe(true); });
    it('model blocklist', () => { expect(isModelBlocked('gpt-4o', ['gpt-4o'])).toBe(true); });
    it('parseModelRef', () => { expect(parseModelRef('openai/gpt-4o').provider).toBe('openai'); });
    it('createModelPlan', () => { expect(createModelPlan('claude-3', ['gpt-4o']).fallbacks).toEqual(['gpt-4o']); });
    it('inferProvider', () => { expect(inferProvider('claude-3-5-sonnet')).toBe('anthropic'); expect(inferProvider('gpt-4o')).toBe('openai'); expect(inferProvider('gemini-2.0')).toBe('google'); });
    it('provider policy', () => { expect(DEFAULT_PROVIDER_POLICY.maxRequestsPerMinute).toBe(60); });
    it('static providers', () => { expect(STATIC_PROVIDERS).toContain('openai'); });
});

describe('Subagent extensions', () => {
    it('announcement lifecycle', () => { clearAnnouncements(); announceSubagent({ agentId: 'a', parentId: 'p', sessionId: 's', task: 't', status: 'started' }); expect(formatAnnouncement({ agentId: 'a', parentId: 'p', sessionId: 's', task: 't', status: 'completed', timestamp: Date.now() })).toContain('✅'); });
    it('announcement queue', () => { enqueueAnnouncement('a', 'msg'); expect(queueSize()).toBeGreaterThan(0); drainQueue(); expect(queueSize()).toBe(0); });
    it('capabilities', () => { const caps = createCapabilitySet(['code', 'exec']); expect(hasCapability(caps, 'code')).toBe(true); expect(hasCapability(caps, 'browser')).toBe(false); });
    it('lifecycle events', () => { clearLifecycleLog(); recordLifecycleEvent({ event: 'spawn', agentId: 'a', sessionId: 's' }); });
    it('orphan detection', () => { const orphans = detectOrphans([{ agentId: 'child', sessionId: 's2', parentId: 's1', startedAt: Date.now(), isAlive: true }]); expect(orphans).toHaveLength(1); });
    it('attachments', () => { const a = createAttachment('file.txt', 'content'); expect(totalAttachmentSize([a])).toBe(7); });
    it('registry key', () => { expect(generateRegistryKey('p', 'a')).toBe('p:a'); expect(parseRegistryKey('p:a')).toEqual({ parentId: 'p', agentId: 'a' }); });
    it('lifecycle transition', () => { expect(validateTransition('created', 'starting')).toBe(true); expect(validateTransition('stopped', 'running')).toBe(false); });
    it('run manager', () => { const rm = new RunManager(2); expect(rm.start('a')).toBe(true); expect(rm.start('b')).toBe(true); expect(rm.start('c')).toBe(false); rm.stop('a'); expect(rm.count()).toBe(1); });
    it('registry state', () => { expect(resolveRegistryState(0, false)).toBe('empty'); expect(resolveRegistryState(1, false)).toBe('active'); expect(resolveRegistryState(1, true)).toBe('draining'); });
    it('completions', () => { clearCompletions(); recordCompletion({ agentId: 'a', sessionId: 's', status: 'success', duration: 100 }); });
});

describe('Session/Tool result', () => {
    it('guard result', () => { expect(guardToolResult('hello').truncated).toBe(false); expect(guardToolResult('x'.repeat(300_000)).truncated).toBe(true); });
    it('repair JSONL', () => { expect(repairJsonl('{"a":1}\nbad\n{"b":2}')).toEqual(['{"a":1}', '{"b":2}']); });
});

describe('Skills', () => {
    it('clawhub url', () => { expect(buildClawHubUrl('test')).toContain('clawhub.dev'); });
    it('install result', () => { expect(formatInstallResult({ skillId: 's', success: true, version: '1.0' })).toContain('✅'); });
    it('status', () => { expect(formatSkillStatus('test', 'installed')).toContain('✅'); });
});

describe('Trace', () => {
    it('create/end span', () => { const s = createSpan('test'); expect(s.traceId).toMatch(/^tr_/); const ended = endSpan(s); expect(ended.endTime).toBeGreaterThan(0); expect(spanDurationMs(ended)).toBeGreaterThanOrEqual(0); });
});

describe('Misc modules', () => {
    it('btw', () => { expect(formatBtw('tip')).toContain('BTW'); expect(shouldShowBtw(5)).toBe(true); expect(shouldShowBtw(3)).toBe(false); });
    it('docs-path', () => { expect(resolveDocsPath('/ws')).toContain('.coreblow/docs'); });
    it('owner-display', () => { expect(formatOwner('Alice', 'a@b.com')).toBe('Alice <a@b.com>'); expect(formatOwner()).toBe('unknown'); });
    it('avatar', () => { expect(resolveAvatar()).toBe('🤖'); expect(resolveAvatar('🐙')).toBe('🐙'); });
    it('attribution', () => { expect(formatAttribution('Anthropic', 'Claude')).toContain('Powered by'); });
    it('claude cli config', () => { expect(resolveClaudeCliConfig({}).model).toContain('claude'); });
    it('coreblow tools', () => { expect(isCoreBlowTool('bash')).toBe(true); expect(isCoreBlowTool('fake')).toBe(false); });
    it('ollama url', () => { expect(OLLAMA_DEFAULT_URL).toContain('11434'); });
    it('media path', () => { expect(isMediaPath('photo.png')).toBe(true); expect(isMediaPath('code.ts')).toBe(false); });
    it('workspace template', () => { expect(detectTemplate(['next.config.js'])).toBe('nextjs'); expect(detectTemplate(['vite.config.ts'])).toBe('vite'); });
    it('mask key', () => { expect(maskKey('sk-1234567890')).toBe('sk-1…7890'); });
    it('failover error', () => { expect(classifyFailoverError(new Error('rate limit 429'))).toBe('rate_limit'); expect(isRetryableError('rate_limit')).toBe(true); expect(isRetryableError('auth')).toBe(false); });
    it('spawned context', () => { const c = createSpawnedContext('p1', 'do stuff'); expect(c.parentSessionId).toBe('p1'); expect(c.maxTurns).toBe(20); });
    it('anthropic payload log', () => { const log = logAnthropicPayload('request', { api_key: 'secret' }); expect((log.payload as any).api_key).toBe('[REDACTED]'); });
    it('anthropic usage', () => { expect(extractAnthropicUsage({ usage: { input_tokens: 100, output_tokens: 50 } })).toEqual({ inputTokens: 100, outputTokens: 50 }); });
    it('mock response', () => { expect(createMockResponse('hi').content[0].text).toBe('hi'); });
    it('pty keys', () => { expect(getKeySequence('enter')).toBe('\r'); });
    it('memory search', () => { expect(searchMessages([{ content: 'hello world' }, { content: 'foo bar' }], 'hello')).toEqual([0]); });
    it('prompt report', () => { const r = generatePromptReport('## Section\nContent'); expect(r.charCount).toBeGreaterThan(0); expect(r.sections).toBe(1); });
});
