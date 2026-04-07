import { describe, it, expect } from 'vitest';
import { resolveMissingBins, resolveMissingAnyBins, RequirementChecker } from './requirements.js';
import { formatAssistantError, isRetryableError, isCloudflareOrHtmlErrorPage } from './assistant-error-format.js';
import { isTruthy, resolveConfigPath, evaluateRuntimeRequires } from './config-eval.js';
import { UsageTracker, mergeUsageLatency } from './usage-tracker.js';
import { resolveEntryStatus, resolveEmojiAndHomepage, EntryStatus } from './entry-metadata.js';
import { stripEnvelope, stripMessageIdHints, extractTextFromChatContent, extractFirstTextBlock } from './chat-envelope.js';

describe('Shared Utils', () => {

    describe('requirements.ts', () => {
        it('resolves missing bins', () => {
            const missing = resolveMissingBins({
                required: ['npm', 'grep', 'unknown-bin'],
                hasLocalBin: (bin) => bin === 'npm',
                hasRemoteBin: (bin) => bin === 'grep',
            });
            expect(missing).toEqual(['unknown-bin']);
        });

        it('resolves any bins (OR condition)', () => {
            const missing = resolveMissingAnyBins({
                required: ['yarn', 'pnpm', 'npm'],
                hasLocalBin: (bin) => bin === 'npm',
            });
            expect(missing).toEqual([]); // Because npm exists locally

            const missingAll = resolveMissingAnyBins({
                required: ['yarn', 'pnpm'],
                hasLocalBin: () => false,
            });
            expect(missingAll).toEqual(['yarn', 'pnpm']);
        });

        it('RequirementChecker checks properly', () => {
            const checker = new RequirementChecker(
                (bin) => bin === 'node',
                (env) => env === 'API_KEY'
            );
            const res = checker.checkBinaryRequirements(['node', 'python']);
            expect(res[0].ok).toBe(true);
            expect(res[1].ok).toBe(false);
            expect(res[1].message).toContain('Missing binary');
            
            const envRes = checker.checkEnvRequirements(['API_KEY', 'SECRET']);
            expect(envRes[0].ok).toBe(true);
            expect(envRes[1].ok).toBe(false);
        });
    });

    describe('assistant-error-format.ts', () => {
        it('formats error objects gracefully', () => {
            const err = new Error('HTTP 404: Not Found { "type": "error", "message": "Unknown model" }');
            const fmt = formatAssistantError(err);
            expect(fmt).toContain('Unknown model');
        });

        it('identifies retryable HTTP codes', () => {
             // Need to format so parseApiErrorInfo can see the HTTP Code and a payload starting with '{'
            expect(isRetryableError(new Error('429 {"error":{"message": "limit"}}'))).toBe(true);
            expect(isRetryableError(new Error('502 {"error":{"code":"retry"}}'))).toBe(true);
            expect(isRetryableError(new Error('400 {"error":{"message": "bad"}}'))).toBe(false);
        });

        it('detects Cloudflare HTML errors', () => {
            // Need just 522 ... <html>
            expect(isCloudflareOrHtmlErrorPage('522 <!doctype html><html>...')).toBe(true);
            expect(isCloudflareOrHtmlErrorPage('200 OK')).toBe(false);
        });
    });

    describe('config-eval.ts', () => {
        it('isTruthy evaluates truthiness accurately', () => {
            expect(isTruthy(true)).toBe(true);
            expect(isTruthy(1)).toBe(true);
            expect(isTruthy("text")).toBe(true);
            expect(isTruthy(false)).toBe(false);
            expect(isTruthy(0)).toBe(false);
            expect(isTruthy("")).toBe(false);
            expect(isTruthy(null)).toBe(false);
        });

        it('resolveConfigPath resolves deep properties', () => {
            const config = { api: { keys: { openai: '123' } } };
            expect(resolveConfigPath(config, 'api.keys.openai')).toBe('123');
            expect(resolveConfigPath(config, 'api.unknown')).toBeUndefined();
        });

        it('evaluateRuntimeRequires verifies combinations of requirements', () => {
            const qualified = evaluateRuntimeRequires({
                requires: { bins: ['node'], env: ['API_KEY'] },
                hasBin: (bin) => bin === 'node',
                hasEnv: (env) => env === 'API_KEY',
                isConfigPathTruthy: () => true
            });
            expect(qualified).toBe(true);

            const disqualified = evaluateRuntimeRequires({
                requires: { bins: ['python'] },
                hasBin: (bin) => bin === 'node',
                hasEnv: () => true,
                isConfigPathTruthy: () => true
            });
            expect(disqualified).toBe(false);
        });
    });

    describe('usage-tracker.ts', () => {
        it('tracks usage accurately', () => {
            const tracker = new UsageTracker();
            tracker.recordUsage({ model: 'gpt-4o', inputTokens: 10, outputTokens: 20, cost: 0.1, timestamp: Date.now() });
            tracker.recordUsage({ model: 'gpt-4o', inputTokens: 5, outputTokens: 5, cost: 0.05, timestamp: Date.now() });
            tracker.recordUsage({ model: 'claude', inputTokens: 100, outputTokens: 0, cost: 0.5, timestamp: Date.now() });

            const summary = tracker.getUsageSummary();
            expect(summary.recordCount).toBe(3);
            expect(summary.totalTokens).toBe(140);
            expect(summary.totalCost).toBe(0.65);

            const byModel = tracker.getUsageByModel();
            expect(byModel.get('gpt-4o')?.cost).toBeCloseTo(0.15);
            expect(byModel.get('claude')?.tokens).toBe(100);
        });

        it('merges latency totals properly', () => {
            const totals = { count: 0, sum: 0, min: Infinity, max: 0, p95Max: 0 };
            mergeUsageLatency(totals, { count: 10, avgMs: 100, minMs: 50, maxMs: 200, p95Ms: 190 });
            expect(totals.count).toBe(10);
            expect(totals.sum).toBe(1000);
            expect(totals.min).toBe(50);
            expect(totals.max).toBe(200);

            mergeUsageLatency(totals, { count: 5, avgMs: 50, minMs: 20, maxMs: 100, p95Ms: 90 });
            expect(totals.count).toBe(15);
            expect(totals.min).toBe(20);
        });
    });

    describe('entry-metadata.ts', () => {
        it('resolves emoji and homepage from frontmatter', () => {
            const meta = resolveEmojiAndHomepage({
                metadata: { emoji: '🚀' },
                frontmatter: { url: 'https://example.com' }
            });
            expect(meta.emoji).toBe('🚀');
            expect(meta.homepage).toBe('https://example.com');
        });

        it('resolves entry status correctly', () => {
            expect(resolveEntryStatus({ status: 'RUNNING' })).toBe(EntryStatus.Running);
            expect(resolveEntryStatus({ running: false })).toBe(EntryStatus.Stopped);
            expect(resolveEntryStatus({})).toBe(EntryStatus.Unknown);
        });
    });

    describe('chat-envelope.ts', () => {
        it('strips envelope headers', () => {
            expect(stripEnvelope('[WhatsApp ] Hello there')).toBe('Hello there');
            expect(stripEnvelope('[2023-10-10T10:00Z] System message')).toBe('System message');
            expect(stripEnvelope('Normal message')).toBe('Normal message');
        });

        it('strips message ID hints', () => {
            const msg = 'User input\n[message_id: 12345]\nMore text';
            expect(stripMessageIdHints(msg)).toBe('User input\nMore text');
        });

        it('extracts text from content blocks', () => {
            const blocks = [
                { type: 'text', text: 'Hello ' },
                { type: 'image' },
                { type: 'text', text: 'world' }
            ];
            expect(extractTextFromChatContent(blocks)).toBe('Hello world');
        });

        it('extracts first text block from message', () => {
            const msg = { content: [{ type: 'text', text: 'First block' }, { type: 'text', text: 'Second' }] };
            expect(extractFirstTextBlock(msg)).toBe('First block');
        });
    });
});
