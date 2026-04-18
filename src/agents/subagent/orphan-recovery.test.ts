// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import {
    recordScanResult,
    getRecoveryMetrics,
    resetRecoveryMetrics,
    formatRecoveryMetrics,
    getOrphanDiagnostics,
    onOrphanEvent,
    emitOrphanEvent,
    clearOrphanEventHandlers,
    resetOrphanRecoveryState,
} from './subagent-orphan-recovery.js';

describe('Subagent Orphan Recovery — Phase 13', () => {

    beforeEach(() => {
        resetRecoveryMetrics();
        resetOrphanRecoveryState();
        clearOrphanEventHandlers();
    });

    // ─── Recovery Metrics ──────────────────────────────────────

    describe('recovery metrics', () => {
        it('starts at zero', () => {
            const m = getRecoveryMetrics();
            expect(m.totalScans).toBe(0);
            expect(m.totalOrphansDetected).toBe(0);
        });

        it('records scan results', () => {
            recordScanResult({ scannedAt: Date.now(), orphansDetected: 3, orphansRecovered: 1, orphansKilled: 1, orphansSkipped: 1 });
            const m = getRecoveryMetrics();
            expect(m.totalScans).toBe(1);
            expect(m.totalOrphansDetected).toBe(3);
            expect(m.totalRecovered).toBe(1);
            expect(m.totalKilled).toBe(1);
            expect(m.totalSkipped).toBe(1);
            expect(m.avgOrphansPerScan).toBe(3);
        });

        it('averages across multiple scans', () => {
            recordScanResult({ scannedAt: Date.now(), orphansDetected: 4, orphansRecovered: 0, orphansKilled: 0, orphansSkipped: 4 });
            recordScanResult({ scannedAt: Date.now(), orphansDetected: 2, orphansRecovered: 0, orphansKilled: 0, orphansSkipped: 2 });
            expect(getRecoveryMetrics().avgOrphansPerScan).toBe(3);
        });

        it('reset clears all', () => {
            recordScanResult({ scannedAt: Date.now(), orphansDetected: 5, orphansRecovered: 2, orphansKilled: 3, orphansSkipped: 0 });
            resetRecoveryMetrics();
            const m = getRecoveryMetrics();
            expect(m.totalScans).toBe(0);
            expect(m.lastScanAt).toBeUndefined();
        });

        it('formats metrics string', () => {
            recordScanResult({ scannedAt: Date.now(), orphansDetected: 2, orphansRecovered: 1, orphansKilled: 1, orphansSkipped: 0 });
            const str = formatRecoveryMetrics(getRecoveryMetrics());
            expect(str).toContain('Scans: 1');
            expect(str).toContain('Detected: 2');
            expect(str).toContain('Recovered: 1');
        });
    });

    // ─── Orphan Diagnostics ────────────────────────────────────

    describe('diagnostics', () => {
        it('returns empty when no recovery state', () => {
            const d = getOrphanDiagnostics();
            expect(d.pendingRecovery).toBe(0);
            expect(d.maxAttemptsReached).toBe(0);
            expect(d.activeOrphans).toEqual([]);
        });
    });

    // ─── Event Hooks ───────────────────────────────────────────

    describe('orphan event hooks', () => {
        it('registers and fires handler', () => {
            const events: string[] = [];
            onOrphanEvent((type, runId) => events.push(`${type}:${runId}`));
            emitOrphanEvent('detected', 'run-1');
            emitOrphanEvent('recovered', 'run-2');
            expect(events).toEqual(['detected:run-1', 'recovered:run-2']);
        });

        it('unsubscribe removes handler', () => {
            const events: string[] = [];
            const unsub = onOrphanEvent((type, runId) => events.push(`${type}:${runId}`));
            emitOrphanEvent('detected', 'run-1');
            unsub();
            emitOrphanEvent('killed', 'run-2');
            expect(events).toEqual(['detected:run-1']);
        });

        it('handler errors are swallowed', () => {
            onOrphanEvent(() => { throw new Error('boom'); });
            // Should not throw
            expect(() => emitOrphanEvent('retry', 'run-1')).not.toThrow();
        });

        it('clearOrphanEventHandlers removes all', () => {
            const events: string[] = [];
            onOrphanEvent((type) => events.push(type));
            clearOrphanEventHandlers();
            emitOrphanEvent('skipped', 'run-1');
            expect(events).toEqual([]);
        });
    });
});
