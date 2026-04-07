/**
 * Tests for CoreBlow Bootstrap System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    calculateBootstrapBudget,
    fitsInBudget,
    deductFromBudget,
    prioritizeFiles,
    createBootstrapFile,
    getCachedBootstrap,
    cacheBootstrap,
    clearBootstrapCache,
    getBootstrapCacheStats,
    registerBootstrapHook,
    executeBootstrapHooks,
    clearBootstrapHooks,
    listBootstrapHooks,
    runBootstrap,
    type BootstrapFile,
    type BootstrapBudget,
} from './bootstrap.js';

describe('calculateBootstrapBudget', () => {
    it('should calculate budget for 128k context window', () => {
        const budget = calculateBootstrapBudget({ contextWindowTokens: 128_000 });
        expect(budget.maxTokens).toBeGreaterThan(0);
        expect(budget.systemPromptTokens).toBeGreaterThan(0);
        expect(budget.contextFileTokens).toBeGreaterThan(0);
        expect(budget.skillsTokens).toBeGreaterThan(0);
        expect(budget.memoryTokens).toBeGreaterThan(0);
        // Total allocated should not exceed max
        const total = budget.systemPromptTokens + budget.contextFileTokens + budget.skillsTokens + budget.memoryTokens + budget.remaining;
        expect(total).toBe(budget.maxTokens);
    });

    it('should respect custom system prompt tokens', () => {
        const budget = calculateBootstrapBudget({
            contextWindowTokens: 128_000,
            systemPromptTokens: 8000,
        });
        expect(budget.systemPromptTokens).toBe(8000);
    });

    it('should handle small context windows', () => {
        const budget = calculateBootstrapBudget({ contextWindowTokens: 4096 });
        expect(budget.maxTokens).toBeGreaterThan(0);
    });
});

describe('fitsInBudget', () => {
    it('should return true when tokens fit', () => {
        const budget: BootstrapBudget = {
            maxTokens: 10000,
            systemPromptTokens: 2000,
            contextFileTokens: 5000,
            skillsTokens: 2000,
            memoryTokens: 1000,
            remaining: 500,
        };
        expect(fitsInBudget(budget, 400)).toBe(true);
    });

    it('should return false when tokens exceed remaining', () => {
        const budget: BootstrapBudget = {
            maxTokens: 10000,
            systemPromptTokens: 2000,
            contextFileTokens: 5000,
            skillsTokens: 2000,
            memoryTokens: 1000,
            remaining: 100,
        };
        expect(fitsInBudget(budget, 500)).toBe(false);
    });
});

describe('deductFromBudget', () => {
    it('should deduct tokens and update remaining', () => {
        const budget: BootstrapBudget = {
            maxTokens: 10000,
            systemPromptTokens: 2000,
            contextFileTokens: 5000,
            skillsTokens: 2000,
            memoryTokens: 1000,
            remaining: 500,
        };
        const result = deductFromBudget(budget, 300, 'remaining');
        expect(result.remaining).toBe(200);
    });
});

describe('prioritizeFiles', () => {
    const budget: BootstrapBudget = {
        maxTokens: 10000,
        systemPromptTokens: 2000,
        contextFileTokens: 1000,
        skillsTokens: 2000,
        memoryTokens: 1000,
        remaining: 500,
    };

    it('should always include required files', () => {
        const files: BootstrapFile[] = [
            { path: 'AGENTS.md', content: 'x'.repeat(4000), tokenEstimate: 1000, priority: 'required', source: 'workspace' },
            { path: 'README.md', content: 'y'.repeat(400), tokenEstimate: 100, priority: 'low', source: 'workspace' },
        ];
        const result = prioritizeFiles(files, budget);
        expect(result.some((f) => f.path === 'AGENTS.md')).toBe(true);
    });

    it('should sort by priority then size', () => {
        const files: BootstrapFile[] = [
            { path: 'low.md', content: '', tokenEstimate: 100, priority: 'low', source: 'workspace' },
            { path: 'high.md', content: '', tokenEstimate: 100, priority: 'high', source: 'workspace' },
            { path: 'medium.md', content: '', tokenEstimate: 100, priority: 'medium', source: 'workspace' },
        ];
        const result = prioritizeFiles(files, budget);
        expect(result[0]!.path).toBe('high.md');
        expect(result[1]!.path).toBe('medium.md');
        expect(result[2]!.path).toBe('low.md');
    });

    it('should respect budget limit', () => {
        const files: BootstrapFile[] = Array.from({ length: 20 }, (_, i) => ({
            path: `file-${i}.md`,
            content: '',
            tokenEstimate: 200,
            priority: 'medium' as const,
            source: 'workspace' as const,
        }));
        const result = prioritizeFiles(files, budget);
        const totalTokens = result.reduce((sum, f) => sum + f.tokenEstimate, 0);
        expect(totalTokens).toBeLessThanOrEqual(budget.contextFileTokens);
    });
});

describe('createBootstrapFile', () => {
    it('should create a file entry with token estimate', () => {
        const file = createBootstrapFile('/project/README.md', 'Hello world!');
        expect(file.path).toBe('/project/README.md');
        expect(file.tokenEstimate).toBeGreaterThan(0);
        expect(file.priority).toBe('medium');
        expect(file.source).toBe('workspace');
    });

    it('should respect custom options', () => {
        const file = createBootstrapFile('/project/AGENTS.md', 'Instructions', {
            priority: 'required',
            source: 'config',
        });
        expect(file.priority).toBe('required');
        expect(file.source).toBe('config');
    });
});

describe('Bootstrap Cache', () => {
    beforeEach(() => clearBootstrapCache());

    it('should cache and retrieve bootstrap results', () => {
        const files: BootstrapFile[] = [createBootstrapFile('test.md', 'content')];
        const budget = calculateBootstrapBudget({ contextWindowTokens: 8192 });
        cacheBootstrap('test-key', files, budget, 60_000);
        const cached = getCachedBootstrap('test-key');
        expect(cached).not.toBeNull();
        expect(cached!.files).toEqual(files);
    });

    it('should expire old entries', () => {
        const budget = calculateBootstrapBudget({ contextWindowTokens: 8192 });
        cacheBootstrap('expired-key', [], budget, 1); // 1ms TTL
        // Wait for expiry
        const start = Date.now();
        while (Date.now() - start < 10) { /* busy wait */ }
        expect(getCachedBootstrap('expired-key')).toBeNull();
    });

    it('should track hits', () => {
        const budget = calculateBootstrapBudget({ contextWindowTokens: 8192 });
        cacheBootstrap('hit-key', [], budget, 60_000);
        getCachedBootstrap('hit-key');
        getCachedBootstrap('hit-key');
        const cached = getCachedBootstrap('hit-key');
        expect(cached!.hits).toBe(3);
    });

    it('should report stats', () => {
        const budget = calculateBootstrapBudget({ contextWindowTokens: 8192 });
        cacheBootstrap('k1', [], budget);
        cacheBootstrap('k2', [], budget);
        const stats = getBootstrapCacheStats();
        expect(stats.size).toBe(2);
    });
});

describe('Bootstrap Hooks', () => {
    beforeEach(() => clearBootstrapHooks());

    it('should register and list hooks', () => {
        registerBootstrapHook({
            name: 'test-hook',
            phase: 'pre-boot',
            handler: async () => {},
        });
        expect(listBootstrapHooks()).toHaveLength(1);
    });

    it('should execute hooks for a phase', async () => {
        let executed = false;
        registerBootstrapHook({
            name: 'test-hook',
            phase: 'post-boot',
            handler: async () => { executed = true; },
        });

        const context = {
            workspaceDir: '/test',
            agentId: 'default',
            sessionId: 'sess-1',
            budget: calculateBootstrapBudget({ contextWindowTokens: 8192 }),
            files: [],
        };

        await executeBootstrapHooks('post-boot', context);
        expect(executed).toBe(true);
    });

    it('should not execute hooks for different phase', async () => {
        let executed = false;
        registerBootstrapHook({
            name: 'test-hook',
            phase: 'pre-boot',
            handler: async () => { executed = true; },
        });

        const context = {
            workspaceDir: '/test',
            agentId: 'default',
            sessionId: 'sess-1',
            budget: calculateBootstrapBudget({ contextWindowTokens: 8192 }),
            files: [],
        };

        await executeBootstrapHooks('post-boot', context);
        expect(executed).toBe(false);
    });

    it('should handle hook errors gracefully', async () => {
        registerBootstrapHook({
            name: 'failing-hook',
            phase: 'pre-boot',
            handler: async () => { throw new Error('hook failure'); },
        });

        const context = {
            workspaceDir: '/test',
            agentId: 'default',
            sessionId: 'sess-1',
            budget: calculateBootstrapBudget({ contextWindowTokens: 8192 }),
            files: [],
        };

        // Should not throw
        await expect(executeBootstrapHooks('pre-boot', context)).resolves.toBeUndefined();
    });
});

describe('runBootstrap', () => {
    beforeEach(() => {
        clearBootstrapCache();
        clearBootstrapHooks();
    });

    it('should run the complete bootstrap pipeline', async () => {
        const files = [
            createBootstrapFile('README.md', 'Project readme'),
            createBootstrapFile('AGENTS.md', 'Agent config', { priority: 'required' }),
        ];

        const result = await runBootstrap({
            workspaceDir: '/test/project',
            agentId: 'default',
            sessionId: 'sess-1',
            contextWindowTokens: 128_000,
            files,
            useCache: false,
        });

        expect(result.workspaceDir).toBe('/test/project');
        expect(result.agentId).toBe('default');
        expect(result.files.length).toBeGreaterThan(0);
        expect(result.budget.maxTokens).toBeGreaterThan(0);
    });

    it('should use cache on second call', async () => {
        const files = [createBootstrapFile('test.md', 'content')];

        await runBootstrap({
            workspaceDir: '/test',
            agentId: 'default',
            sessionId: 'sess-1',
            contextWindowTokens: 8192,
            files,
        });

        const stats = getBootstrapCacheStats();
        expect(stats.size).toBe(1);
    });
});
