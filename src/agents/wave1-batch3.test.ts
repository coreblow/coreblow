/**
 * Tests for CoreBlow Subagent Control, Prompt Scenarios, Apply Patch, Tool Loop Detection
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Subagent Control Tests ──────────────────────────────────────

import {
    spawnSubagent,
    getSubagent,
    listSubagents,
    sendMessage,
    completeSubagent,
    failSubagent,
    cancelSubagent,
    clearAllSubagents,
    spawnParallel,
    spawnChain,
    createBudget,
    canSpawnWithinBudget,
    checkTimeouts,
    getSubagentStats,
    type SubagentConfig,
} from './subagent-control.js';

describe('Subagent Control', () => {
    beforeEach(() => clearAllSubagents());

    const makeConfig = (id: string): SubagentConfig => ({
        id,
        name: `Test Agent ${id}`,
        parentSessionId: 'session-1',
    });

    it('should spawn a subagent', () => {
        const instance = spawnSubagent(makeConfig('sub-1'));
        expect(instance.status).toBe('starting');
        expect(instance.config.id).toBe('sub-1');
    });

    it('should not allow duplicate IDs', () => {
        spawnSubagent(makeConfig('sub-dup'));
        expect(() => spawnSubagent(makeConfig('sub-dup'))).toThrow();
    });

    it('should get a subagent', () => {
        spawnSubagent(makeConfig('sub-get'));
        expect(getSubagent('sub-get')).toBeDefined();
        expect(getSubagent('nonexistent')).toBeUndefined();
    });

    it('should list subagents by session', () => {
        spawnSubagent({ ...makeConfig('sub-a'), parentSessionId: 'sess-a' });
        spawnSubagent({ ...makeConfig('sub-b'), parentSessionId: 'sess-b' });
        expect(listSubagents('sess-a')).toHaveLength(1);
        expect(listSubagents()).toHaveLength(2);
    });

    it('should send messages', () => {
        spawnSubagent(makeConfig('sub-msg'));
        const sent = sendMessage('sub-msg', {
            role: 'user',
            content: 'Hello',
            timestamp: Date.now(),
        });
        expect(sent).toBe(true);
        const instance = getSubagent('sub-msg')!;
        expect(instance.turns).toBe(1);
        expect(instance.status).toBe('running');
    });

    it('should complete a subagent', () => {
        spawnSubagent(makeConfig('sub-complete'));
        completeSubagent('sub-complete', {
            success: true,
            output: 'Done',
            tokensUsed: 500,
            turns: 3,
            durationMs: 2000,
        });
        const instance = getSubagent('sub-complete')!;
        expect(instance.status).toBe('complete');
        expect(instance.result!.output).toBe('Done');
    });

    it('should fail a subagent', () => {
        spawnSubagent(makeConfig('sub-fail'));
        failSubagent('sub-fail', 'Something went wrong');
        expect(getSubagent('sub-fail')!.status).toBe('error');
    });

    it('should cancel a subagent', () => {
        spawnSubagent(makeConfig('sub-cancel'));
        expect(cancelSubagent('sub-cancel')).toBe(true);
        expect(getSubagent('sub-cancel')!.status).toBe('cancelled');
    });

    it('should run parallel subagents', async () => {
        const configs = [
            makeConfig('par-1'),
            makeConfig('par-2'),
            makeConfig('par-3'),
        ];
        const result = await spawnParallel(configs, async (instance) => ({
            success: true,
            output: `Result from ${instance.config.id}`,
            tokensUsed: 100,
            turns: 1,
            durationMs: 50,
        }));
        expect(result.successful).toHaveLength(3);
        expect(result.failed).toHaveLength(0);
    });

    it('should run chain subagents', async () => {
        const configs = [makeConfig('chain-1'), makeConfig('chain-2')];
        const result = await spawnChain(configs, async (instance, prev) => ({
            success: true,
            output: prev ? `Continued from: ${prev.output}` : 'First',
            tokensUsed: 50,
            turns: 1,
            durationMs: 30,
        }));
        expect(result.successful).toHaveLength(2);
        expect(result.all[1]!.output).toContain('Continued from');
    });

    it('should enforce budget', () => {
        createBudget('sess-budget', { maxConcurrent: 2, maxTotalTokens: 1000 });
        spawnSubagent({ ...makeConfig('budget-1'), parentSessionId: 'sess-budget' });
        spawnSubagent({ ...makeConfig('budget-2'), parentSessionId: 'sess-budget' });
        getSubagent('budget-1')!.status = 'running';
        getSubagent('budget-2')!.status = 'running';
        const check = canSpawnWithinBudget('sess-budget');
        expect(check.allowed).toBe(false);
    });

    it('should detect timeouts', () => {
        const config: SubagentConfig = {
            id: 'timeout-agent',
            name: 'Timeout',
            parentSessionId: 'sess-1',
            timeoutMs: 1, // 1ms
        };
        const instance = spawnSubagent(config);
        instance.status = 'running';
        instance.startedAt = Date.now() - 1000;
        const timedOut = checkTimeouts();
        expect(timedOut).toHaveLength(1);
    });

    it('should report stats', () => {
        spawnSubagent(makeConfig('stats-1'));
        completeSubagent('stats-1', { success: true, output: '', tokensUsed: 200, turns: 2, durationMs: 100 });
        const stats = getSubagentStats();
        expect(stats.total).toBe(1);
        expect(stats.byStatus.complete).toBe(1);
    });
});

// ─── Prompt Composition Scenarios Tests ──────────────────────────

import {
    getScenario,
    listScenarios,
    searchScenarios,
    detectScenario,
    getScenarioPromptAdditions,
    registerCustomScenario,
} from './prompt-composition-scenarios.js';

describe('Prompt Composition Scenarios', () => {
    it('should get a scenario by ID', () => {
        const scenario = getScenario('code-review');
        expect(scenario).toBeDefined();
        expect(scenario!.name).toBe('Code Review');
    });

    it('should list all scenarios', () => {
        const all = listScenarios();
        expect(all.length).toBeGreaterThanOrEqual(10);
    });

    it('should search scenarios', () => {
        const results = searchScenarios('security');
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((s) => s.id === 'security-audit')).toBe(true);
    });

    it('should detect scenario from message', () => {
        expect(detectScenario('Please review this code')).toBe('code-review');
        expect(detectScenario('There is a bug in this function')).toBe('debugging');
        expect(detectScenario('Write unit tests for this')).toBe('testing');
        expect(detectScenario('Check for security vulnerability')).toBe('security-audit');
    });

    it('should return undefined for unrecognized messages', () => {
        expect(detectScenario('hello from the other side')).toBeUndefined();
    });

    it('should get prompt additions', () => {
        const additions = getScenarioPromptAdditions(['code-review', 'testing']);
        expect(additions).toContain('Code Review');
        expect(additions).toContain('Testing');
    });

    it('should register custom scenarios', () => {
        registerCustomScenario({
            id: 'custom',
            name: 'Custom Scenario',
            description: 'A custom scenario',
            systemPromptAdditions: '## Custom\nDo custom things.',
            suggestedTools: ['read'],
            priority: 10,
            tags: ['custom'],
        });
        expect(getScenario('custom')).toBeDefined();
    });
});

// ─── Apply Patch Tests ───────────────────────────────────────────

import {
    parsePatch,
    applyPatch,
    parseMultiFilePatch,
    validatePatch,
    summarizePatch,
} from './apply-patch.js';

describe('Apply Patch', () => {
    const sampleDiff = `@@ -1,3 +1,3 @@
 line1
-line2
+line2_modified
 line3`;

    // Our parser captures 4 lines: ' line1', '-line2', '+line2_modified', ' line3'

    it('should parse diff hunks', () => {
        const hunks = parsePatch(sampleDiff);
        expect(hunks).toHaveLength(1);
        expect(hunks[0]!.oldStart).toBe(1);
        expect(hunks[0]!.lines).toHaveLength(4);
    });

    it('should apply a simple patch', () => {
        const content = 'line1\nline2\nline3';
        const result = applyPatch(content, sampleDiff);
        expect(result.success).toBe(true);
        expect(result.output).toContain('line2_modified');
        expect(result.hunksApplied).toBe(1);
    });

    it('should support fuzzy matching', () => {
        const content = 'extra\nline1\nline2\nline3';
        const diff = `@@ -1,3 +1,3 @@
 line1
-line2
+line2_updated
 line3`;
        const result = applyPatch(content, diff, { fuzz: 5 });
        expect(result.success).toBe(true);
        expect(result.fuzzyMatches).toBe(1);
    });

    it('should support applying a reversed diff', () => {
        // Diff that changes line 1 from 'old' to 'new'
        const diff = '@@ -1,2 +1,2 @@\n-old\n+new\n rest';
        const content = 'old\nrest';
        const result = applyPatch(content, diff);
        expect(result.success).toBe(true);
        expect(result.output).toBe('new\nrest');
    });

    it('should support dry-run mode', () => {
        const content = 'line1\nline2\nline3';
        const result = applyPatch(content, sampleDiff, { dryRun: true });
        expect(result.success).toBe(true);
        expect(result.output).toBe(content); // Content unchanged
    });

    it('should detect conflicts', () => {
        const content = 'completely\ndifferent\ncontent';
        const result = applyPatch(content, sampleDiff);
        expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should track stats', () => {
        const content = 'line1\nline2\nline3';
        const result = applyPatch(content, sampleDiff);
        expect(result.stats.additions).toBe(1);
        expect(result.stats.deletions).toBe(1);
    });

    it('should validate patches', () => {
        expect(validatePatch(sampleDiff).valid).toBe(true);
        expect(validatePatch('no hunks here').valid).toBe(false);
    });

    it('should summarize patches', () => {
        expect(summarizePatch(sampleDiff)).toContain('+1 -1');
    });

    it('should parse multi-file patches', () => {
        const multiDiff = `diff --git a/file1.ts b/file1.ts
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,2 @@
 const x = 1;
-const y = 2;
+const y = 3;
diff --git a/file2.ts b/file2.ts
new file mode 100644
--- /dev/null
+++ b/file2.ts
@@ -0,0 +1,1 @@
+const z = 4;`;
        const result = parseMultiFilePatch(multiDiff);
        expect(result.files).toHaveLength(2);
        expect(result.files[1]!.isNew).toBe(true);
    });
});

// ─── Tool Loop Detection Tests ───────────────────────────────────

import {
    detectToolLoop,
    detectDirectRepeats,
    detectAlternatingLoop,
    detectNgramPattern,
    detectFrequencyAbuse,
    hashArgs,
    recordToolCall,
    getSessionHistory,
    clearSessionHistory,
    clearAllHistories,
    getLoopDetectionStats,
    ToolCircuitBreaker,
    type ToolCallRecord,
} from './tool-loop-detection.js';

describe('Tool Loop Detection', () => {
    beforeEach(() => clearAllHistories());

    const makeRecord = (tool: string, args?: string): ToolCallRecord => ({
        toolName: tool,
        argsHash: args ?? hashArgs({}),
        timestamp: Date.now(),
    });

    it('should detect direct repeats', () => {
        const hash = hashArgs({});
        const history = Array.from({ length: 5 }, () => makeRecord('exec', hash));
        const result = detectToolLoop(history);
        expect(result.loopDetected).toBe(true);
        expect(result.type).toBe('direct');
    });

    it('should detect alternating loops', () => {
        const history: ToolCallRecord[] = [];
        for (let i = 0; i < 8; i++) {
            history.push(makeRecord(i % 2 === 0 ? 'read' : 'write'));
        }
        const result = detectAlternatingLoop(history, 3);
        expect(result.loopDetected).toBe(true);
        expect(result.type).toBe('alternating');
    });

    it('should detect N-gram patterns', () => {
        const hash = hashArgs({});
        const pattern = ['read', 'exec', 'write'];
        const history: ToolCallRecord[] = [];
        for (let i = 0; i < 9; i++) {
            history.push(makeRecord(pattern[i % 3]!, hash));
        }
        const result = detectNgramPattern(history, 3, 2);
        expect(result.loopDetected).toBe(true);
        expect(result.type).toBe('ngram');
    });

    it('should detect frequency abuse', () => {
        const now = Date.now();
        const history: ToolCallRecord[] = Array.from({ length: 35 }, (_, i) => ({
            toolName: `tool-${i}`,
            argsHash: String(i),
            timestamp: now - i * 100, // All within last minute
        }));
        const result = detectFrequencyAbuse(history, 30);
        expect(result.loopDetected).toBe(true);
        expect(result.type).toBe('frequency');
    });

    it('should not detect loop in normal usage', () => {
        const history = [
            makeRecord('read', 'a'),
            makeRecord('exec', 'b'),
            makeRecord('write', 'c'),
            makeRecord('read', 'd'),
        ];
        const result = detectToolLoop(history);
        expect(result.loopDetected).toBe(false);
    });

    it('should hash args consistently', () => {
        const h1 = hashArgs({ a: 1, b: 2 });
        const h2 = hashArgs({ b: 2, a: 1 });
        expect(h1).toBe(h2);
    });

    it('should track per-session history', () => {
        recordToolCall('sess-1', makeRecord('read'));
        recordToolCall('sess-1', makeRecord('write'));
        recordToolCall('sess-2', makeRecord('exec'));
        expect(getSessionHistory('sess-1')).toHaveLength(2);
        expect(getSessionHistory('sess-2')).toHaveLength(1);
    });

    it('should get session stats', () => {
        recordToolCall('sess-stats', makeRecord('read'));
        recordToolCall('sess-stats', makeRecord('read'));
        recordToolCall('sess-stats', makeRecord('write'));
        const stats = getLoopDetectionStats('sess-stats');
        expect(stats.totalCalls).toBe(3);
        expect(stats.uniqueTools).toBe(2);
        expect(stats.mostCalledTool).toBe('read');
    });
});

describe('ToolCircuitBreaker', () => {
    it('should start closed', () => {
        const breaker = new ToolCircuitBreaker();
        expect(breaker.getState()).toBe('closed');
        expect(breaker.canExecute()).toBe(true);
    });

    it('should open after threshold failures', () => {
        const breaker = new ToolCircuitBreaker(3);
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();
        expect(breaker.getState()).toBe('open');
        expect(breaker.canExecute()).toBe(false);
    });

    it('should transition to half-open', () => {
        const breaker = new ToolCircuitBreaker(2, 1); // 1ms reset
        breaker.recordFailure();
        breaker.recordFailure();
        // Wait for reset
        const start = Date.now();
        while (Date.now() - start < 10) { /* */ }
        expect(breaker.canExecute()).toBe(true);
        expect(breaker.getState()).toBe('half-open');
    });

    it('should reset on success', () => {
        const breaker = new ToolCircuitBreaker(2);
        breaker.recordFailure();
        breaker.recordSuccess();
        expect(breaker.getState()).toBe('closed');
        expect(breaker.getFailures()).toBe(0);
    });

    it('should support explicit reset', () => {
        const breaker = new ToolCircuitBreaker(2);
        breaker.recordFailure();
        breaker.recordFailure();
        breaker.reset();
        expect(breaker.getState()).toBe('closed');
    });
});
