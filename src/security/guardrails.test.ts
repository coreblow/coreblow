/**
 * CoreBlow — Guardrails Engine Unit Tests
 *
 * Integration-style tests: the engine instantiates real sub-modules
 * (ToxicityDetector, BiasDetector, PIIScanner, ContentFilter, SafetyReport),
 * so we test the orchestration and policy enforcement end-to-end.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { GuardrailsEngine } from './guardrails.js';
import type { EnforcementPolicy } from './guardrails.js';

describe('GuardrailsEngine', () => {
    let engine: GuardrailsEngine;

    beforeEach(() => {
        engine = new GuardrailsEngine();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should default to standard policy', () => {
            expect(engine.getPolicy()).toBe('standard');
        });

        it('should enable all checks by default', () => {
            const checks = engine.getEnabledChecks();
            expect(checks.toxicity).toBe(true);
            expect(checks.bias).toBe(true);
            expect(checks.pii).toBe(true);
            expect(checks.content).toBe(true);
        });

        it('should accept custom policy', () => {
            const strict = new GuardrailsEngine({ policy: 'strict' });
            expect(strict.getPolicy()).toBe('strict');
        });

        it('should accept disabled checks', () => {
            const e = new GuardrailsEngine({ toxicity: { enabled: false }, bias: { enabled: false } });
            const checks = e.getEnabledChecks();
            expect(checks.toxicity).toBe(false);
            expect(checks.bias).toBe(false);
            expect(checks.pii).toBe(true);
            expect(checks.content).toBe(true);
        });
    });

    // ─── Clean Content ───────────────────────────────────────────

    describe('clean content', () => {
        it('should pass clean text as safe and not blocked', () => {
            const result = engine.scan('Hello, how are you today?');
            expect(result.safe).toBe(true);
            expect(result.blocked).toBe(false);
            expect(result.enforcements).toHaveLength(0);
        });

        it('should include policy in result', () => {
            const result = engine.scan('Hello');
            expect(result.policy).toBe('standard');
        });

        it('should include report in result', () => {
            const result = engine.scan('Hello');
            expect(result.report).toBeDefined();
            expect(result.report.overallSafe).toBe(true);
        });

        it('should truncate text in result to 200 chars', () => {
            const long = 'a'.repeat(500);
            const result = engine.scan(long);
            expect(result.text.length).toBe(200);
        });
    });

    // ─── Content Filter — Block on threats ───────────────────────

    describe('content filter enforcement', () => {
        it('should block threatening content in standard mode', () => {
            const result = engine.scan('I will murder you');
            expect(result.blocked).toBe(true);
            expect(result.content).toBeDefined();
            expect(result.content!.passed).toBe(false);
            expect(result.enforcements.some((e) => e.includes('content filter'))).toBe(true);
        });

        it('should NOT block in monitor mode', () => {
            const monitor = new GuardrailsEngine({ policy: 'monitor' });
            const result = monitor.scan('I will murder you');
            expect(result.blocked).toBe(false);
        });
    });

    // ─── PII Detection & Masking ─────────────────────────────────

    describe('PII enforcement', () => {
        it('should detect PII and mask in standard mode', () => {
            const result = engine.scan('My email is john@example.com');
            expect(result.pii).toBeDefined();
            expect(result.pii!.hasPII).toBe(true);
            expect(result.filteredText).toBeDefined();
            expect(result.filteredText).not.toContain('john@example.com');
            expect(result.enforcements.some((e) => e.includes('PII masked'))).toBe(true);
        });

        it('should block PII in strict mode', () => {
            const strict = new GuardrailsEngine({ policy: 'strict' });
            const result = strict.scan('SSN: 123-45-6789');
            expect(result.blocked).toBe(true);
            expect(result.enforcements.some((e) => e.includes('Blocked: PII'))).toBe(true);
        });

        it('should NOT mask PII in monitor mode', () => {
            const monitor = new GuardrailsEngine({ policy: 'monitor' });
            const result = monitor.scan('Email: test@example.com');
            // monitor: maskPII=false, blockOnPII=false
            expect(result.blocked).toBe(false);
            expect(result.enforcements.filter((e) => e.includes('PII'))).toHaveLength(0);
        });
    });

    // ─── Toxicity Detection ──────────────────────────────────────

    describe('toxicity enforcement', () => {
        it('should detect toxic insults', () => {
            const result = engine.scan('You are a stupid idiot moron');
            expect(result.toxicity).toBeDefined();
            expect(result.toxicity!.toxic).toBe(true);
        });

        it('should block toxic content in standard mode', () => {
            const result = engine.scan('You are a stupid idiot moron');
            expect(result.blocked).toBe(true);
            expect(result.enforcements.some((e) => e.includes('toxic'))).toBe(true);
        });

        it('should NOT block toxic content in permissive mode', () => {
            const permissive = new GuardrailsEngine({ policy: 'permissive' });
            const result = permissive.scan('You are a stupid idiot');
            // permissive: blockOnToxic=false
            expect(result.blocked).toBe(false);
        });
    });

    // ─── isSafe ──────────────────────────────────────────────────

    describe('isSafe', () => {
        it('should return true for clean text', () => {
            expect(engine.isSafe('Hello, world!')).toBe(true);
        });

        it('should return false for unsafe text', () => {
            expect(engine.isSafe('I will murder you')).toBe(false);
        });
    });

    // ─── scanBatch ───────────────────────────────────────────────

    describe('scanBatch', () => {
        it('should scan multiple texts', () => {
            const results = engine.scanBatch(['Hello', 'Normal text', 'I will murder you']);
            expect(results).toHaveLength(3);
            expect(results[0].safe).toBe(true);
            expect(results[2].blocked).toBe(true);
        });
    });

    // ─── Policy Switching ────────────────────────────────────────

    describe('setPolicy', () => {
        it('should switch policy', () => {
            engine.setPolicy('strict');
            expect(engine.getPolicy()).toBe('strict');
        });

        it('should update thresholds when policy changes', () => {
            engine.setPolicy('permissive');
            expect(engine.getPolicy()).toBe('permissive');
            // permissive has higher toxicity threshold (0.7)
            // Mild toxicity that would be caught in standard should pass in permissive
        });
    });

    // ─── Enable/Disable Checks ───────────────────────────────────

    describe('enableCheck / disableCheck', () => {
        it('should disable a specific check', () => {
            engine.disableCheck('toxicity');
            expect(engine.getEnabledChecks().toxicity).toBe(false);

            const result = engine.scan('You are a stupid idiot moron');
            expect(result.toxicity).toBeUndefined();
        });

        it('should re-enable a check', () => {
            engine.disableCheck('pii');
            engine.enableCheck('pii');
            expect(engine.getEnabledChecks().pii).toBe(true);
        });

        it('should skip disabled content filter', () => {
            engine.disableCheck('content');
            const result = engine.scan('I will murder you');
            expect(result.content).toBeUndefined();
        });
    });

    // ─── Stats ───────────────────────────────────────────────────

    describe('stats', () => {
        it('should track scan count', () => {
            engine.scan('Hello');
            engine.scan('World');
            const stats = engine.getStats();
            expect(stats.scans).toBe(2);
        });

        it('should track blocked count', () => {
            engine.scan('I will murder you');
            expect(engine.getStats().blocked).toBe(1);
        });

        it('should compute blockRate', () => {
            engine.scan('Hello');
            engine.scan('I will murder you');
            expect(engine.getStats().blockRate).toBeCloseTo(0.5);
        });

        it('should include sub-module stats', () => {
            engine.scan('test@example.com');
            const stats = engine.getStats();
            expect(stats.pii).toBeDefined();
            expect(stats.toxicity).toBeDefined();
            expect(stats.bias).toBeDefined();
            expect(stats.contentFilter).toBeDefined();
            expect(stats.safetyReports).toBeDefined();
        });
    });

    // ─── Accessors ───────────────────────────────────────────────

    describe('accessors', () => {
        it('should expose sub-modules via getters', () => {
            expect(engine.getToxicity()).toBeDefined();
            expect(engine.getBias()).toBeDefined();
            expect(engine.getPII()).toBeDefined();
            expect(engine.getContentFilter()).toBeDefined();
        });
    });

    // ─── getRecentReports ────────────────────────────────────────

    describe('getRecentReports', () => {
        it('should return recent safety reports', () => {
            engine.scan('Hello');
            engine.scan('World');
            const reports = engine.getRecentReports(2);
            expect(reports).toHaveLength(2);
        });
    });
});
