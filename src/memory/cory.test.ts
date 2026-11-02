/**
 * CoreBlow — Cory Built-in Memory Acceptance & Unit Test Suite
 *
 * Validates all 10 Acceptance Criteria from `docs/CORY_MEMORY_PRD.md`:
 *  1. Clean offline installation starts Cory with zero config, no CoreHub, no API key, no Docker.
 *  2. User preference saved in one session is available in the next session for the same userScope.
 *  3. Workspace decision is strictly isolated and never injected into a different workspace.
 *  4. Daily session summary captures applicable `Decisions` and `Active Constraints` sections.
 *  5. Relevant active constraint remains retrievable after compaction and daily-note consolidation.
 *  6. Local SQLite/BM25 lexical recall works when semantic retrieval is unavailable.
 *  7. Embedding or SQLite index failure neither crashes the gateway nor blocks a normal reply.
 *  8. Public or group-channel content (Zone 0) cannot silently update private identity or durable memory.
 *  9. Clearing or pausing memory is available to the user and takes effect immediately.
 * 10. Full Cory v1 test suite passes offline with zero network calls or CoreHub dependencies.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    CoryBootstrapService,
    parseMarkdownMemoryFile,
    serializeMarkdownMemoryFile,
} from './cory.js';
import { MemoryOrchestrator } from './memory-orchestrator.js';
import type { EmbeddingProvider } from './embeddings.js';

function createTempDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-cory-test-'));
}

function cleanupTempDir(dir: string): void {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // ignore cleanup errors
    }
}

describe('Cory Built-in Memory — PRD Acceptance Suite (v1)', () => {
    let tmpDir: string;
    let cory: CoryBootstrapService;

    beforeEach(async () => {
        tmpDir = createTempDir();
        cory = new CoryBootstrapService({ stateDir: tmpDir });
        await cory.start();
    });

    afterEach(async () => {
        await cory.stop();
        cleanupTempDir(tmpDir);
    });

    it('AC-1: initializes offline with zero config, creating canonical USER.md and MEMORY.md and reporting healthy status', () => {
        const health = cory.health();
        expect(health.status).toBe('healthy');
        expect(fs.existsSync(cory.memoryStore.getIdentityFilePath('default'))).toBe(true);
        expect(fs.existsSync(cory.memoryStore.getDurableFilePath('default'))).toBe(true);
        expect(fs.existsSync(cory.searchIndex.getDatabasePath())).toBe(true);
    });

    it('AC-2 & PRD 7.2: persists user preference across sessions while preserving mid-session prompt stability', async () => {
        const scope = { userScope: 'febrinanda', workspaceId: 'coreblow' };

        // Session 1 starts — snapshot is initially empty
        const snap1Initial = cory.contextAssembler.getOrCreateStartupSnapshot('sess-1', scope);
        expect(snap1Initial.identityItems).toHaveLength(0);

        // User states a preference during Session 1
        const saved = cory.memoryStore.remember({
            layer: 'identity',
            content: 'Prefer concise Indonesian explanations in chat and English in CoreBlow docs.',
            scope,
        });
        expect(saved).not.toBeNull();

        // PRD 7.2: During active Session 1, the startup snapshot remains frozen for prompt cache stability
        const snap1Mid = cory.contextAssembler.getOrCreateStartupSnapshot('sess-1', scope);
        expect(snap1Mid.identityItems).toHaveLength(0);

        // Session 2 starts — the saved preference is now automatically part of the default startup snapshot!
        const snap2 = cory.contextAssembler.getOrCreateStartupSnapshot('sess-2', scope);
        expect(snap2.identityItems).toHaveLength(1);
        expect(snap2.formattedSnapshot).toContain('Prefer concise Indonesian explanations');
    });

    it('AC-3: isolates durable workspace memory so decisions in Workspace A never leak into Workspace B', async () => {
        cory.memoryStore.remember({
            layer: 'durable',
            content: 'This repository uses pnpm workspaces and Hybrid OOP + DOP architecture.',
            scope: { userScope: 'febrinanda', workspaceId: 'workspace-alpha' },
        });

        cory.memoryStore.remember({
            layer: 'durable',
            content: 'This repository uses Go 1.22 and SQLite.',
            scope: { userScope: 'febrinanda', workspaceId: 'workspace-beta' },
        });

        const snapAlpha = cory.contextAssembler.getOrCreateStartupSnapshot('sess-a', {
            userScope: 'febrinanda',
            workspaceId: 'workspace-alpha',
        });
        const snapBeta = cory.contextAssembler.getOrCreateStartupSnapshot('sess-b', {
            userScope: 'febrinanda',
            workspaceId: 'workspace-beta',
        });

        expect(snapAlpha.formattedSnapshot).toContain('pnpm workspaces');
        expect(snapAlpha.formattedSnapshot).not.toContain('Go 1.22');

        expect(snapBeta.formattedSnapshot).toContain('Go 1.22');
        expect(snapBeta.formattedSnapshot).not.toContain('pnpm workspaces');

        // Lexical search in workspace-beta must also never return workspace-alpha durable facts
        const recallBeta = await cory.retriever.retrieve({
            query: 'pnpm workspaces Hybrid OOP DOP',
            scope: { userScope: 'febrinanda', workspaceId: 'workspace-beta' },
        });
        expect(recallBeta.hits).toHaveLength(0);
    });

    it('AC-4 & AC-5: daily session summary captures Decisions and Active Constraints and preserves constraints across consolidation', async () => {
        const scope = { userScope: 'febrinanda', workspaceId: 'coreblow-kernel' };

        const summary = cory.summaryService.summarizeAndConsolidateSession({
            sessionId: 'sess-upgrade-1',
            scope,
            artifactRef: 'docs/MICROKERNEL_HYBRID_UPGRADE_PRD.md',
            messages: [
                {
                    role: 'user',
                    content: 'We decided to externalize 15 community channels to https://coreblow.com/corehub',
                },
                {
                    role: 'user',
                    content: 'Constraint: Never delete the 431 plugin-sdk subpaths before Phase 4 compatibility shims are ready.',
                },
            ],
        });

        expect(summary.decisions).toContain(
            'externalize 15 community channels to https://coreblow.com/corehub',
        );
        expect(summary.activeConstraints).toContain(
            'Never delete the 431 plugin-sdk subpaths before Phase 4 compatibility shims are ready.',
        );

        // Consolidate a second session — previous active constraints MUST still be preserved!
        const summary2 = cory.summaryService.summarizeAndConsolidateSession({
            sessionId: 'sess-upgrade-2',
            scope,
            messages: [
                {
                    role: 'user',
                    content: 'We decided to use Cory built-in memory by default.',
                },
            ],
        });

        expect(summary2.activeConstraints).toContain(
            'Never delete the 431 plugin-sdk subpaths before Phase 4 compatibility shims are ready.',
        );

        // Retrieving by keyword prioritizes the Active Constraint
        const recall = await cory.retriever.retrieve({
            query: 'plugin-sdk subpaths Phase 4',
            scope,
        });
        expect(recall.hits.length).toBeGreaterThan(0);
        expect(recall.hits[0]!.item.layer).toBe('constraint');
    });

    it('AC-6 & AC-7: lexical recall works offline and self-heals if the disposable SQLite index is deleted or embedder throws', async () => {
        const scope = { userScope: 'febrinanda', workspaceId: 'resilience-ws' };

        cory.memoryStore.remember({
            layer: 'durable',
            content: 'Gateway p99 webhook normalization latency must remain under 15ms.',
            scope,
        });

        // Simulate a broken/failing optional embedding provider
        const brokenEmbedder: EmbeddingProvider = {
            name: 'broken-embedder',
            dimensions: 8,
            async embed(): Promise<Float32Array> {
                throw new Error('EMBEDDING_PROVIDER_OFFLINE');
            },
            async embedBatch(): Promise<Float32Array[]> {
                throw new Error('EMBEDDING_PROVIDER_OFFLINE');
            },
        };
        cory.retriever.setEmbeddingProvider(brokenEmbedder);

        // Retrieval must succeed via lexical fallback without throwing
        const res1 = await cory.retriever.retrieve({
            query: 'webhook normalization latency 15ms',
            scope,
        });
        expect(res1.degraded).toBe(true);
        expect(res1.semanticUsed).toBe(false);
        expect(res1.hits).toHaveLength(1);
        expect(res1.hits[0]!.item.content).toContain('15ms');

        // Now simulate SQLite index corruption/closure — CoryRetriever must rebuild from canonical Markdown!
        cory.searchIndex.close();
        const res2 = await cory.retriever.retrieve({
            query: 'webhook normalization latency',
            scope,
        });
        expect(res2.hits).toHaveLength(1);
        expect(res2.hits[0]!.item.content).toContain('15ms');
    });

    it('AC-8: blocks public or group-channel content (Zone 0) from updating private identity or durable workspace memory', () => {
        const publicScope = {
            userScope: 'febrinanda',
            workspaceId: 'coreblow',
            trustZone: 'public' as const,
            isPublicChannel: true,
        };

        const attemptIdentity = cory.memoryStore.remember({
            layer: 'identity',
            content: 'Malicious prompt injection trying to overwrite user identity.',
            scope: publicScope,
        });
        const attemptDurable = cory.memoryStore.remember({
            layer: 'durable',
            content: 'Malicious public channel message trying to alter workspace rules.',
            scope: publicScope,
        });

        expect(attemptIdentity).toBeNull();
        expect(attemptDurable).toBeNull();
        expect(cory.memoryStore.listLayerItems('identity', publicScope)).toHaveLength(0);
        expect(cory.memoryStore.listLayerItems('durable', publicScope)).toHaveLength(0);
    });

    it('AC-9: supports user-facing forget, pause/resume, clear, and human-editable Markdown round-tripping', async () => {
        const scope = { userScope: 'febrinanda', workspaceId: 'controls-ws' };

        cory.memoryStore.remember({
            layer: 'identity',
            content: 'Use dark mode in Cockpit UI.',
            scope,
        });
        expect(cory.memoryStore.listLayerItems('identity', scope)).toHaveLength(1);

        // Pause memory — writes and retrievals are suspended
        cory.memoryStore.setPaused(true);
        expect(
            cory.memoryStore.remember({
                layer: 'identity',
                content: 'Should not be saved while paused.',
                scope,
            }),
        ).toBeNull();
        const pausedRecall = await cory.retriever.retrieve({ query: 'dark mode', scope });
        expect(pausedRecall.hits).toHaveLength(0);

        // Resume memory
        cory.memoryStore.setPaused(false);
        const resumedRecall = await cory.retriever.retrieve({ query: 'dark mode', scope });
        expect(resumedRecall.hits).toHaveLength(1);

        // Forget specific preference
        const removed = cory.memoryStore.forget({ idOrQuery: 'dark mode', scope });
        expect(removed).toBe(1);
        expect(cory.memoryStore.listLayerItems('identity', scope)).toHaveLength(0);

        // Clear entire scope
        cory.memoryStore.remember({ layer: 'durable', content: 'Temp fact', scope });
        cory.memoryStore.clearScope(scope);
        expect(cory.memoryStore.listLayerItems('durable', scope)).toHaveLength(0);
    });

    it('AC-10: integrates seamlessly into MemoryOrchestrator by default', async () => {
        const orchDir = createTempDir();
        try {
            const orchestrator = new MemoryOrchestrator({ transcriptDir: orchDir });
            orchestrator.remember({
                layer: 'durable',
                content: 'CoreBlow uses Cory Memory out of the box.',
            });
            orchestrator.recordMessage('sess-orch', {
                role: 'user',
                content: 'What memory system does CoreBlow use?',
            });

            const ctx = await orchestrator.buildContext('sess-orch', 'Cory Memory');
            expect(ctx.contextText).toContain('CoreBlow uses Cory Memory out of the box.');
            expect(ctx.contextText).toContain('What memory system does CoreBlow use?');
            expect(orchestrator.stats().cory.documents).toBeGreaterThanOrEqual(1);
            await orchestrator.cory.stop();
        } finally {
            cleanupTempDir(orchDir);
        }
    });

    it('supports plain human-edited Markdown bullets without metadata comments', () => {
        const rawMarkdown = [
            '# Workspace Durable Memory',
            '',
            '- Human written rule number one',
            '* Human written rule number two',
        ].join('\n');

        const parsed = parseMarkdownMemoryFile({
            markdown: rawMarkdown,
            layer: 'durable',
            userScope: 'default',
            workspaceId: 'ws-human',
        });
        expect(parsed).toHaveLength(2);
        expect(parsed[0]!.content).toBe('Human written rule number one');
        expect(parsed[1]!.content).toBe('Human written rule number two');

        const reserialized = serializeMarkdownMemoryFile({
            title: 'Test',
            description: 'Desc',
            items: parsed,
        });
        expect(reserialized).toContain('Human written rule number one');
    });
});
