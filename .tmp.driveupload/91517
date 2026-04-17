/**
 * agents/bootstrap-budget.test.ts
 */
import { describe, it, expect } from 'vitest';
import { BudgetTracker, resolveBudgetConfig } from './bootstrap-budget.js';

describe('Bootstrap Budget', () => {
    describe('BudgetTracker', () => {
        it('tracks tokens', () => {
            const bt = new BudgetTracker();
            bt.record({ inputTokens: 1000, outputTokens: 500 });
            const snap = bt.snapshot();
            expect(snap.turnTokens).toBe(1500);
            expect(snap.sessionTokens).toBe(1500);
        });

        it('tracks cost', () => {
            const bt = new BudgetTracker();
            bt.record({ inputTokens: 1000, outputTokens: 500, cost: 0.05 });
            expect(bt.snapshot().turnCost).toBe(0.05);
        });

        it('resets turn', () => {
            const bt = new BudgetTracker();
            bt.record({ inputTokens: 1000, outputTokens: 500 });
            bt.resetTurn();
            expect(bt.snapshot().turnTokens).toBe(0);
            expect(bt.snapshot().sessionTokens).toBe(1500);
        });

        it('detects exceeded', () => {
            const bt = new BudgetTracker({ maxTokensPerTurn: 100 });
            bt.record({ inputTokens: 50, outputTokens: 60 });
            expect(bt.isExceeded()).toBe(true);
        });

        it('warns at threshold', () => {
            const bt = new BudgetTracker({ maxTokensPerTurn: 100, warningThresholdPct: 80 });
            bt.record({ inputTokens: 40, outputTokens: 45 });
            expect(bt.snapshot().warnings.length).toBeGreaterThan(0);
        });

        it('formats status', () => {
            const bt = new BudgetTracker();
            bt.record({ inputTokens: 1000, outputTokens: 500, cost: 0.1 });
            expect(bt.formatStatus()).toContain('1,500');
            expect(bt.formatStatus()).toContain('$0.100');
        });
    });

    describe('resolveBudgetConfig', () => {
        it('returns defaults', () => {
            const cfg = resolveBudgetConfig();
            expect(cfg.maxTokensPerTurn).toBe(200_000);
        });
        it('uses overrides', () => {
            const cfg = resolveBudgetConfig({ agents: { budget: { maxTokensPerTurn: 50000 } } });
            expect(cfg.maxTokensPerTurn).toBe(50000);
        });
    });
});
