/**
 * Tests for Subagent Announce Output (CoreBlow Parity)
 *
 * Covers: silent detection, text extraction, tool call counting,
 * output snapshot, output selection, outcome application,
 * child completion findings, stats formatting, normalization,
 * truncation, outcome formatters, output validators, multi-child summary.
 */
import { describe, it, expect } from 'vitest';
import {
    isSilentReplyText,
    isAnnounceSkip,
    extractAssistantText,
    summarizeSubagentOutputHistory,
    selectSubagentOutputText,
    applySubagentWaitOutcome,
    buildChildCompletionFindings,
    dedupeLatestChildCompletionRows,
    filterCurrentDirectChildCompletionRows,
    buildCompactAnnounceStatsLine,
    normalizeOutputText,
    stripControlCharacters,
    sanitizeOutputForDisplay,
    truncateOutput,
    truncateByLines,
    buildOutputSummary,
    formatOutcomeStatus,
    formatOutcomeForDisplay,
    isSuccessOutcome,
    isErrorOutcome,
    isTimeoutOutcome,
    isEmptyOutput,
    isUsefulOutput,
    estimateOutputQuality,
    buildMultiChildSummary,
    countChildOutcomes,
    MAX_OUTPUT_CHARS,
    MAX_OUTPUT_LINES,
    SUMMARY_HEAD_LINES,
    SUMMARY_TAIL_LINES,
    type SubagentRunOutcome,
    type SubagentOutputSnapshot,
    type ChildSummaryEntry,
} from '../../src/agents/subagent/subagent-announce-output.js';

// ═══════════════════════════════════════════════════════════════
// SILENT DETECTION
// ═══════════════════════════════════════════════════════════════

describe('isSilentReplyText', () => {
    it('detects NO_REPLY', () => {
        expect(isSilentReplyText('NO_REPLY')).toBe(true);
    });

    it('detects [NO_REPLY]', () => {
        expect(isSilentReplyText('[NO_REPLY]')).toBe(true);
    });

    it('detects SKIP', () => {
        expect(isSilentReplyText('SKIP')).toBe(true);
    });

    it('detects [SKIP]', () => {
        expect(isSilentReplyText('[SKIP]')).toBe(true);
    });

    it('detects SILENT', () => {
        expect(isSilentReplyText('SILENT')).toBe(true);
    });

    it('detects [SILENT]', () => {
        expect(isSilentReplyText('[SILENT]')).toBe(true);
    });

    it('is case insensitive', () => {
        expect(isSilentReplyText('no_reply')).toBe(true);
        expect(isSilentReplyText('Skip')).toBe(true);
    });

    it('trims whitespace', () => {
        expect(isSilentReplyText('  NO_REPLY  ')).toBe(true);
    });

    it('returns false for empty', () => {
        expect(isSilentReplyText('')).toBe(false);
        expect(isSilentReplyText(undefined)).toBe(false);
    });

    it('returns false for normal text', () => {
        expect(isSilentReplyText('Hello world')).toBe(false);
    });
});

describe('isAnnounceSkip', () => {
    it('detects SKIP', () => {
        expect(isAnnounceSkip('SKIP')).toBe(true);
    });

    it('detects [SKIP]', () => {
        expect(isAnnounceSkip('[SKIP]')).toBe(true);
    });

    it('is case insensitive', () => {
        expect(isAnnounceSkip('skip')).toBe(true);
    });

    it('returns false for NO_REPLY', () => {
        expect(isAnnounceSkip('NO_REPLY')).toBe(false);
    });

    it('returns false for empty', () => {
        expect(isAnnounceSkip('')).toBe(false);
        expect(isAnnounceSkip(undefined)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// TEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════

describe('extractAssistantText', () => {
    it('extracts string content from assistant message', () => {
        expect(extractAssistantText({ role: 'assistant', content: 'Hello' })).toBe('Hello');
    });

    it('extracts from array content with text blocks', () => {
        const msg = {
            role: 'assistant',
            content: [
                { type: 'text', text: 'Part 1' },
                { type: 'text', text: ' Part 2' },
            ],
        };
        expect(extractAssistantText(msg)).toBe('Part 1 Part 2');
    });

    it('extracts from array with string elements', () => {
        const msg = { role: 'assistant', content: ['Hello', ' World'] };
        expect(extractAssistantText(msg)).toBe('Hello World');
    });

    it('returns empty for non-assistant role', () => {
        expect(extractAssistantText({ role: 'user', content: 'Hello' })).toBe('');
    });

    it('returns empty for null/undefined', () => {
        expect(extractAssistantText(null)).toBe('');
        expect(extractAssistantText(undefined)).toBe('');
    });

    it('returns empty for non-object', () => {
        expect(extractAssistantText('string')).toBe('');
        expect(extractAssistantText(42)).toBe('');
    });

    it('trims result', () => {
        expect(extractAssistantText({ role: 'assistant', content: '  hello  ' })).toBe('hello');
    });
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT SNAPSHOT
// ═══════════════════════════════════════════════════════════════

describe('summarizeSubagentOutputHistory', () => {
    it('returns empty snapshot for no messages', () => {
        const s = summarizeSubagentOutputHistory([]);
        expect(s.assistantFragments).toHaveLength(0);
        expect(s.toolCallCount).toBe(0);
        expect(s.latestAssistantText).toBeUndefined();
    });

    it('captures assistant text', () => {
        const s = summarizeSubagentOutputHistory([
            { role: 'assistant', content: 'Hello world' },
        ]);
        expect(s.latestAssistantText).toBe('Hello world');
        expect(s.assistantFragments).toContain('Hello world');
    });

    it('captures multiple assistant fragments', () => {
        const s = summarizeSubagentOutputHistory([
            { role: 'assistant', content: 'First' },
            { role: 'assistant', content: 'Second' },
        ]);
        expect(s.assistantFragments).toHaveLength(2);
        expect(s.latestAssistantText).toBe('Second');
    });

    it('handles silent messages by clearing fragments', () => {
        const s = summarizeSubagentOutputHistory([
            { role: 'assistant', content: 'First' },
            { role: 'assistant', content: 'NO_REPLY' },
        ]);
        expect(s.latestSilentText).toBe('NO_REPLY');
        expect(s.latestAssistantText).toBeUndefined();
        expect(s.assistantFragments).toHaveLength(0);
    });

    it('counts tool calls', () => {
        const s = summarizeSubagentOutputHistory([
            {
                role: 'assistant',
                content: [
                    { type: 'toolCall', name: 'bash' },
                    { type: 'tool_use', name: 'file_edit' },
                ],
            },
        ]);
        expect(s.toolCallCount).toBe(2);
    });

    it('captures raw text from tool results', () => {
        const s = summarizeSubagentOutputHistory([
            { role: 'toolResult', content: 'tool output here' },
        ]);
        expect(s.latestRawText).toBe('tool output here');
    });

    it('skips null/undefined messages', () => {
        const s = summarizeSubagentOutputHistory([null, undefined, {}]);
        expect(s.assistantFragments).toHaveLength(0);
    });

    it('handles SKIP as silent', () => {
        const s = summarizeSubagentOutputHistory([
            { role: 'assistant', content: 'Real result' },
            { role: 'assistant', content: '[SKIP]' },
        ]);
        expect(s.latestSilentText).toBe('[SKIP]');
        expect(s.latestAssistantText).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT SELECTION
// ═══════════════════════════════════════════════════════════════

describe('selectSubagentOutputText', () => {
    it('returns silent text if present', () => {
        const snapshot: SubagentOutputSnapshot = {
            latestSilentText: 'NO_REPLY',
            latestAssistantText: 'something',
            assistantFragments: ['something'],
            toolCallCount: 0,
        };
        expect(selectSubagentOutputText(snapshot)).toBe('NO_REPLY');
    });

    it('returns assistant text if present', () => {
        const snapshot: SubagentOutputSnapshot = {
            latestAssistantText: 'result',
            assistantFragments: ['result'],
            toolCallCount: 0,
        };
        expect(selectSubagentOutputText(snapshot)).toBe('result');
    });

    it('returns partial progress for timeout with tool calls', () => {
        const snapshot: SubagentOutputSnapshot = {
            assistantFragments: [],
            toolCallCount: 5,
        };
        const outcome: SubagentRunOutcome = { status: 'timeout' };
        const result = selectSubagentOutputText(snapshot, outcome);
        expect(result).toContain('Partial progress');
        expect(result).toContain('5 tool call');
    });

    it('returns raw text as fallback', () => {
        const snapshot: SubagentOutputSnapshot = {
            latestRawText: 'raw output',
            assistantFragments: [],
            toolCallCount: 0,
        };
        expect(selectSubagentOutputText(snapshot)).toBe('raw output');
    });

    it('returns undefined when nothing available', () => {
        const snapshot: SubagentOutputSnapshot = {
            assistantFragments: [],
            toolCallCount: 0,
        };
        expect(selectSubagentOutputText(snapshot)).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// OUTCOME APPLICATION
// ═══════════════════════════════════════════════════════════════

describe('applySubagentWaitOutcome', () => {
    it('applies timeout outcome', () => {
        const result = applySubagentWaitOutcome({
            wait: { status: 'timeout' },
            outcome: undefined,
        });
        expect(result.outcome?.status).toBe('timeout');
    });

    it('applies error outcome', () => {
        const result = applySubagentWaitOutcome({
            wait: { status: 'error', error: 'boom' },
            outcome: undefined,
        });
        expect(result.outcome?.status).toBe('error');
        expect(result.outcome?.error).toBe('boom');
    });

    it('applies ok outcome', () => {
        const result = applySubagentWaitOutcome({
            wait: { status: 'ok' },
            outcome: undefined,
        });
        expect(result.outcome?.status).toBe('ok');
    });

    it('preserves existing outcome when no wait', () => {
        const existing: SubagentRunOutcome = { status: 'ok' };
        const result = applySubagentWaitOutcome({
            wait: undefined,
            outcome: existing,
        });
        expect(result.outcome).toBe(existing);
    });

    it('updates timestamps from wait result', () => {
        const result = applySubagentWaitOutcome({
            wait: { status: 'ok', startedAt: 100, endedAt: 200 },
            outcome: undefined,
        });
        expect(result.startedAt).toBe(100);
        expect(result.endedAt).toBe(200);
    });

    it('does not overwrite existing timestamps', () => {
        const result = applySubagentWaitOutcome({
            wait: { status: 'ok', startedAt: 100, endedAt: 200 },
            outcome: undefined,
            startedAt: 50,
            endedAt: 150,
        });
        expect(result.startedAt).toBe(50);
        expect(result.endedAt).toBe(150);
    });
});

// ═══════════════════════════════════════════════════════════════
// CHILD COMPLETION FINDINGS
// ═══════════════════════════════════════════════════════════════

describe('buildChildCompletionFindings', () => {
    it('returns undefined for empty children', () => {
        expect(buildChildCompletionFindings([])).toBeUndefined();
    });

    it('builds findings for single child', () => {
        const result = buildChildCompletionFindings([{
            childSessionKey: 'c1', task: 'find data', label: 'researcher',
            createdAt: 1000, endedAt: 2000,
            frozenResultText: 'Found 42 results',
            outcome: { status: 'ok' },
        }]);
        expect(result).toContain('researcher');
        expect(result).toContain('ok');
        expect(result).toContain('Found 42 results');
    });

    it('sorts by createdAt', () => {
        const result = buildChildCompletionFindings([
            { childSessionKey: 'c2', task: 'second', createdAt: 2000, outcome: { status: 'ok' } },
            { childSessionKey: 'c1', task: 'first', createdAt: 1000, outcome: { status: 'ok' } },
        ]);
        expect(result!.indexOf('first')).toBeLessThan(result!.indexOf('second'));
    });

    it('handles no output', () => {
        const result = buildChildCompletionFindings([{
            childSessionKey: 'c1', task: 'test', createdAt: 1000,
            outcome: { status: 'ok' },
        }]);
        expect(result).toContain('(no output)');
    });

    it('formats error outcomes', () => {
        const result = buildChildCompletionFindings([{
            childSessionKey: 'c1', task: 'test', createdAt: 1000,
            outcome: { status: 'error', error: 'boom' },
        }]);
        expect(result).toContain('error');
    });

    it('wraps result in untrusted tags', () => {
        const result = buildChildCompletionFindings([{
            childSessionKey: 'c1', task: 'test', createdAt: 1000,
            frozenResultText: 'data',
            outcome: { status: 'ok' },
        }]);
        expect(result).toContain('BEGIN_UNTRUSTED_CHILD_RESULT');
        expect(result).toContain('END_UNTRUSTED_CHILD_RESULT');
    });
});

describe('dedupeLatestChildCompletionRows', () => {
    it('keeps latest by childSessionKey', () => {
        const rows = [
            { childSessionKey: 'c1', createdAt: 1000, runId: 'r1' },
            { childSessionKey: 'c1', createdAt: 2000, runId: 'r2' },
        ];
        const deduped = dedupeLatestChildCompletionRows(rows);
        expect(deduped).toHaveLength(1);
        expect(deduped[0]!.createdAt).toBe(2000);
    });

    it('keeps distinct keys', () => {
        const rows = [
            { childSessionKey: 'c1', createdAt: 1000 },
            { childSessionKey: 'c2', createdAt: 2000 },
        ];
        expect(dedupeLatestChildCompletionRows(rows)).toHaveLength(2);
    });
});

describe('filterCurrentDirectChildCompletionRows', () => {
    it('returns all when no getLatestByChildKey', () => {
        const rows = [{ runId: 'r1', childSessionKey: 'c1', requesterSessionKey: 'p' }];
        const result = filterCurrentDirectChildCompletionRows(rows, { requesterSessionKey: 'p' });
        expect(result).toHaveLength(1);
    });

    it('filters by current run', () => {
        const rows = [
            { runId: 'r1', childSessionKey: 'c1', requesterSessionKey: 'p' },
            { runId: 'r-old', childSessionKey: 'c2', requesterSessionKey: 'p' },
        ];
        const result = filterCurrentDirectChildCompletionRows(rows, {
            requesterSessionKey: 'p',
            getLatestByChildKey: (key) => {
                if (key === 'c1') return { runId: 'r1', requesterSessionKey: 'p' };
                if (key === 'c2') return { runId: 'r-new', requesterSessionKey: 'p' };
                return null;
            },
        });
        expect(result).toHaveLength(1);
        expect(result[0]!.runId).toBe('r1');
    });
});

// ═══════════════════════════════════════════════════════════════
// STATS FORMATTING
// ═══════════════════════════════════════════════════════════════

describe('buildCompactAnnounceStatsLine', () => {
    it('formats runtime and tokens', () => {
        const line = buildCompactAnnounceStatsLine({
            startedAt: 1000, endedAt: 61_000,
            inputTokens: 1500, outputTokens: 500,
        });
        expect(line).toContain('Stats:');
        expect(line).toContain('runtime 1m');
        expect(line).toContain('tokens');
    });

    it('handles missing timestamps', () => {
        const line = buildCompactAnnounceStatsLine({
            inputTokens: 100, outputTokens: 50,
        });
        expect(line).toContain('runtime n/a');
    });

    it('handles zero tokens', () => {
        const line = buildCompactAnnounceStatsLine({});
        expect(line).toContain('tokens 0');
    });

    it('formats large token counts with k suffix', () => {
        const line = buildCompactAnnounceStatsLine({
            inputTokens: 15_000, outputTokens: 5_000,
        });
        expect(line).toContain('k');
    });

    it('formats million token counts with m suffix', () => {
        const line = buildCompactAnnounceStatsLine({
            inputTokens: 1_500_000, outputTokens: 500_000,
        });
        expect(line).toContain('m');
    });

    it('shows prompt/cache when totalTokens exceeds io', () => {
        const line = buildCompactAnnounceStatsLine({
            inputTokens: 100, outputTokens: 50, totalTokens: 1000,
        });
        expect(line).toContain('prompt/cache');
    });
});

// ═══════════════════════════════════════════════════════════════
// NORMALIZATION
// ═══════════════════════════════════════════════════════════════

describe('Output Normalization', () => {
    it('normalizeOutputText converts CRLF', () => {
        expect(normalizeOutputText('a\r\nb')).toBe('a\nb');
    });

    it('normalizeOutputText converts CR', () => {
        expect(normalizeOutputText('a\rb')).toBe('a\nb');
    });

    it('normalizeOutputText converts tabs to spaces', () => {
        expect(normalizeOutputText('a\tb')).toBe('a    b');
    });

    it('normalizeOutputText collapses 3+ newlines', () => {
        expect(normalizeOutputText('a\n\n\n\nb')).toBe('a\n\nb');
    });

    it('normalizeOutputText trims', () => {
        expect(normalizeOutputText('  hello  ')).toBe('hello');
    });

    it('stripControlCharacters removes control chars', () => {
        expect(stripControlCharacters('hello\x00world\x07test')).toBe('helloworldtest');
    });

    it('stripControlCharacters preserves newlines and tabs', () => {
        // \n (\x0A), \r (\x0D), \t (\x09) ARE control chars removed by the regex
        // Actually let's check the regex: [\x00-\x08\x0B\x0C\x0E-\x1F\x7F]
        // It preserves \t(\x09), \n(\x0A), \r(\x0D)
        expect(stripControlCharacters('a\tb\nc\rd')).toBe('a\tb\nc\rd');
    });

    it('sanitizeOutputForDisplay combines both', () => {
        const result = sanitizeOutputForDisplay('  hello\x00\r\nworld  ');
        expect(result).toBe('hello\nworld');
    });
});

// ═══════════════════════════════════════════════════════════════
// TRUNCATION
// ═══════════════════════════════════════════════════════════════

describe('Output Truncation', () => {
    it('truncateOutput returns unchanged if under limit', () => {
        const result = truncateOutput('hello', 100);
        expect(result.text).toBe('hello');
        expect(result.truncated).toBe(false);
    });

    it('truncateOutput truncates long text', () => {
        const text = 'a'.repeat(200);
        const result = truncateOutput(text, 50);
        expect(result.truncated).toBe(true);
        expect(result.text.length).toBeLessThan(200);
        expect(result.text).toContain('truncated');
        expect(result.originalLength).toBe(200);
    });

    it('truncateByLines returns unchanged if under limit', () => {
        const result = truncateByLines('a\nb\nc', 10);
        expect(result.truncated).toBe(false);
        expect(result.lineCount).toBe(3);
    });

    it('truncateByLines truncates with head/tail', () => {
        const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
        const result = truncateByLines(lines, 10);
        expect(result.truncated).toBe(true);
        expect(result.text).toContain('omitted');
    });

    it('buildOutputSummary returns short text unchanged', () => {
        expect(buildOutputSummary('short text')).toBe('short text');
    });

    it('buildOutputSummary truncates long text', () => {
        const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`).join('\n');
        const summary = buildOutputSummary(lines);
        expect(summary).toContain('omitted');
    });

    it('exports constants', () => {
        expect(MAX_OUTPUT_CHARS).toBe(100_000);
        expect(MAX_OUTPUT_LINES).toBe(2000);
        expect(SUMMARY_HEAD_LINES).toBe(50);
        expect(SUMMARY_TAIL_LINES).toBe(50);
    });
});

// ═══════════════════════════════════════════════════════════════
// OUTCOME FORMATTERS
// ═══════════════════════════════════════════════════════════════

describe('Outcome Formatters', () => {
    it('formatOutcomeStatus for ok', () => {
        expect(formatOutcomeStatus({ status: 'ok' })).toContain('completed');
    });

    it('formatOutcomeStatus for error', () => {
        expect(formatOutcomeStatus({ status: 'error', error: 'boom' })).toContain('error');
        expect(formatOutcomeStatus({ status: 'error', error: 'boom' })).toContain('boom');
    });

    it('formatOutcomeStatus for timeout', () => {
        expect(formatOutcomeStatus({ status: 'timeout' })).toContain('timed out');
    });

    it('formatOutcomeStatus for undefined', () => {
        expect(formatOutcomeStatus()).toContain('unknown');
    });

    it('formatOutcomeForDisplay with label', () => {
        const result = formatOutcomeForDisplay({ status: 'ok' }, 'worker');
        expect(result).toContain('[worker]');
        expect(result).toContain('completed');
    });

    it('formatOutcomeForDisplay without label', () => {
        const result = formatOutcomeForDisplay({ status: 'ok' });
        expect(result).not.toContain('[');
    });

    it('isSuccessOutcome', () => {
        expect(isSuccessOutcome({ status: 'ok' })).toBe(true);
        expect(isSuccessOutcome({ status: 'error' })).toBe(false);
        expect(isSuccessOutcome()).toBe(false);
    });

    it('isErrorOutcome', () => {
        expect(isErrorOutcome({ status: 'error' })).toBe(true);
        expect(isErrorOutcome({ status: 'ok' })).toBe(false);
    });

    it('isTimeoutOutcome', () => {
        expect(isTimeoutOutcome({ status: 'timeout' })).toBe(true);
        expect(isTimeoutOutcome({ status: 'ok' })).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// OUTPUT VALIDATORS
// ═══════════════════════════════════════════════════════════════

describe('Output Validators', () => {
    it('isEmptyOutput detects empty', () => {
        expect(isEmptyOutput('')).toBe(true);
        expect(isEmptyOutput('  ')).toBe(true);
        expect(isEmptyOutput(undefined)).toBe(true);
        expect(isEmptyOutput('hello')).toBe(false);
    });

    it('isUsefulOutput filters silent and short', () => {
        expect(isUsefulOutput('hello world')).toBe(true);
        expect(isUsefulOutput('NO_REPLY')).toBe(false);
        expect(isUsefulOutput('SKIP')).toBe(false);
        expect(isUsefulOutput('ab')).toBe(false);
        expect(isUsefulOutput('')).toBe(false);
        expect(isUsefulOutput(undefined)).toBe(false);
    });

    it('estimateOutputQuality categorizes', () => {
        expect(estimateOutputQuality()).toBe('none');
        expect(estimateOutputQuality('')).toBe('none');
        expect(estimateOutputQuality('NO_REPLY')).toBe('silent');
        expect(estimateOutputQuality('SKIP')).toBe('silent');
        expect(estimateOutputQuality('short')).toBe('minimal');
        expect(estimateOutputQuality('a'.repeat(200))).toBe('substantial');
    });
});

// ═══════════════════════════════════════════════════════════════
// MULTI-CHILD SUMMARY
// ═══════════════════════════════════════════════════════════════

describe('Multi-Child Summary', () => {
    it('returns no results message for empty', () => {
        expect(buildMultiChildSummary([])).toBe('No child results.');
    });

    it('builds summary with outcomes', () => {
        const children: ChildSummaryEntry[] = [
            { label: 'worker-1', outcome: { status: 'ok' }, runtimeMs: 5000 },
            { label: 'worker-2', outcome: { status: 'error', error: 'fail' } },
        ];
        const summary = buildMultiChildSummary(children);
        expect(summary).toContain('2 child task(s)');
        expect(summary).toContain('worker-1');
        expect(summary).toContain('worker-2');
        expect(summary).toContain('completed');
    });

    it('includes result preview', () => {
        const children: ChildSummaryEntry[] = [{
            label: 'worker', outcome: { status: 'ok' },
            resultPreview: 'Found 42 items',
        }];
        const summary = buildMultiChildSummary(children);
        expect(summary).toContain('Found 42 items');
    });

    it('truncates long previews', () => {
        const children: ChildSummaryEntry[] = [{
            label: 'worker', outcome: { status: 'ok' },
            resultPreview: 'x'.repeat(500),
        }];
        const summary = buildMultiChildSummary(children);
        expect(summary.length).toBeLessThan(600);
    });

    it('countChildOutcomes tallies correctly', () => {
        const children: ChildSummaryEntry[] = [
            { label: 'a', outcome: { status: 'ok' } },
            { label: 'b', outcome: { status: 'ok' } },
            { label: 'c', outcome: { status: 'error' } },
            { label: 'd', outcome: { status: 'timeout' } },
            { label: 'e', outcome: { status: 'unknown' } },
        ];
        const counts = countChildOutcomes(children);
        expect(counts.total).toBe(5);
        expect(counts.succeeded).toBe(2);
        expect(counts.failed).toBe(1);
        expect(counts.timedOut).toBe(1);
        expect(counts.unknown).toBe(1);
    });

    it('countChildOutcomes handles empty', () => {
        const counts = countChildOutcomes([]);
        expect(counts.total).toBe(0);
        expect(counts.succeeded).toBe(0);
    });
});
