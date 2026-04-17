/**
 * plugins/permission-manager.test.ts
 *
 * Comprehensive test suite for PermissionManager.
 * Tests grant/revoke, request workflow, policies, scoping,
 * expiry, bulk operations, persistence, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    PermissionManager,
    ALL_PERMISSIONS,
    type PermissionRecord,
    type PermissionRequest,
    type PermissionChangeEvent,
} from './permission-manager.js';
import type { Permission } from './sandbox.js';

// ─── Test Suite ──────────────────────────────────────────────────

describe('PermissionManager', () => {
    let pm: PermissionManager;

    beforeEach(() => {
        pm = new PermissionManager();
    });

    // ════════════════════════════════════════════════════════════
    // Grant / Revoke (8 tests)
    // ════════════════════════════════════════════════════════════

    describe('grant and revoke', () => {
        it('should grant a permission', () => {
            const record = pm.grant('plugin-a', 'network');
            expect(record.state).toBe('granted');
            expect(record.pluginId).toBe('plugin-a');
            expect(record.permission).toBe('network');
        });

        it('should check granted permission', () => {
            pm.grant('plugin-a', 'network');
            expect(pm.hasPermission('plugin-a', 'network')).toBe(true);
        });

        it('should return false for ungrated permission', () => {
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should revoke a permission', () => {
            pm.grant('plugin-a', 'network');
            const revoked = pm.revoke('plugin-a', 'network');
            expect(revoked).not.toBeNull();
            expect(revoked!.state).toBe('revoked');
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should deny a permission explicitly', () => {
            const record = pm.deny('plugin-a', 'exec', { reason: 'Security policy' });
            expect(record.state).toBe('denied');
            expect(pm.hasPermission('plugin-a', 'exec')).toBe(false);
        });

        it('should track permission source', () => {
            const record = pm.grant('plugin-a', 'filesystem', { source: 'manifest' });
            expect(record.source).toBe('manifest');
        });

        it('should return null when revoking non-existent permission', () => {
            expect(pm.revoke('unknown', 'network')).toBeNull();
        });

        it('should override previous state on re-grant', () => {
            pm.deny('plugin-a', 'network');
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
            pm.grant('plugin-a', 'network');
            expect(pm.hasPermission('plugin-a', 'network')).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Permission State (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('permission state', () => {
        it('should return null state for unknown plugin', () => {
            expect(pm.getState('unknown', 'network')).toBeNull();
        });

        it('should return correct state after grant', () => {
            pm.grant('plugin-a', 'network');
            expect(pm.getState('plugin-a', 'network')).toBe('granted');
        });

        it('should return correct state after deny', () => {
            pm.deny('plugin-a', 'exec');
            expect(pm.getState('plugin-a', 'exec')).toBe('denied');
        });

        it('should return correct state after revoke', () => {
            pm.grant('plugin-a', 'network');
            pm.revoke('plugin-a', 'network');
            expect(pm.getState('plugin-a', 'network')).toBe('revoked');
        });

        it('should get all permissions for a plugin', () => {
            pm.grant('plugin-a', 'network');
            pm.grant('plugin-a', 'filesystem');
            pm.deny('plugin-a', 'exec');
            const perms = pm.getPluginPermissions('plugin-a');
            expect(perms).toHaveLength(3);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Permission Requests — Prompt Policy (7 tests)
    // ════════════════════════════════════════════════════════════

    describe('request workflow (prompt policy)', () => {
        it('should create a pending request', () => {
            const request = pm.requestPermission('plugin-a', 'network', { reason: 'Need API access' });
            expect(request.status).toBe('pending');
            expect(request.pluginId).toBe('plugin-a');
        });

        it('should add to pending requests list', () => {
            pm.requestPermission('plugin-a', 'network');
            expect(pm.getPendingRequests()).toHaveLength(1);
        });

        it('should approve a pending request', () => {
            const req = pm.requestPermission('plugin-a', 'network');
            const approved = pm.approveRequest(req.id);
            expect(approved).toBe(true);
            expect(pm.hasPermission('plugin-a', 'network')).toBe(true);
        });

        it('should deny a pending request', () => {
            const req = pm.requestPermission('plugin-a', 'exec');
            const denied = pm.denyRequest(req.id);
            expect(denied).toBe(true);
            expect(pm.hasPermission('plugin-a', 'exec')).toBe(false);
        });

        it('should not approve non-pending request', () => {
            const req = pm.requestPermission('plugin-a', 'network');
            pm.approveRequest(req.id);
            expect(pm.approveRequest(req.id)).toBe(false); // Already approved
        });

        it('should not approve unknown request', () => {
            expect(pm.approveRequest('req-999')).toBe(false);
        });

        it('should get plugin requests', () => {
            pm.requestPermission('plugin-a', 'network');
            pm.requestPermission('plugin-a', 'exec');
            pm.requestPermission('plugin-b', 'filesystem');
            expect(pm.getPluginRequests('plugin-a')).toHaveLength(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Policies (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('policies', () => {
        it('should auto-grant with auto-grant policy', () => {
            const autoGrant = new PermissionManager('auto-grant');
            const req = autoGrant.requestPermission('plugin-a', 'network');
            expect(req.status).toBe('approved');
            expect(autoGrant.hasPermission('plugin-a', 'network')).toBe(true);
        });

        it('should auto-deny with deny-all policy', () => {
            const denyAll = new PermissionManager('deny-all');
            const req = denyAll.requestPermission('plugin-a', 'network');
            expect(req.status).toBe('denied');
            expect(denyAll.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should leave pending with prompt policy', () => {
            const req = pm.requestPermission('plugin-a', 'network');
            expect(req.status).toBe('pending');
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should get current policy', () => {
            expect(pm.getPolicy()).toBe('prompt');
        });

        it('should change policy at runtime', () => {
            pm.setPolicy('auto-grant');
            expect(pm.getPolicy()).toBe('auto-grant');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Scoped Permissions (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('scoped permissions', () => {
        it('should grant scoped permission', () => {
            pm.grant('plugin-a', 'network', { scope: 'https://api.example.com' });
            expect(pm.hasPermission('plugin-a', 'network', 'https://api.example.com/v1')).toBe(true);
        });

        it('should deny when scope does not match', () => {
            pm.grant('plugin-a', 'network', { scope: 'https://api.example.com' });
            expect(pm.hasPermission('plugin-a', 'network', 'https://evil.com')).toBe(false);
        });

        it('should allow any scope when no scope restriction set', () => {
            pm.grant('plugin-a', 'network');
            expect(pm.hasPermission('plugin-a', 'network', 'https://anything.com')).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Expiry (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('permission expiry', () => {
        it('should grant with expiry', () => {
            const future = Date.now() + 60_000;
            pm.grant('plugin-a', 'network', { expiresAt: future });
            expect(pm.hasPermission('plugin-a', 'network')).toBe(true);
        });

        it('should expire past-due permission', () => {
            const past = Date.now() - 1000;
            pm.grant('plugin-a', 'network', { expiresAt: past });
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should emit expire event on check', () => {
            const events: string[] = [];
            pm.onChange((e) => events.push(e.type));
            const past = Date.now() - 1000;
            pm.grant('plugin-a', 'network', { expiresAt: past });
            pm.hasPermission('plugin-a', 'network'); // triggers expire
            expect(events).toContain('expire');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Bulk Operations (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('bulk operations', () => {
        it('should grant manifest permissions', () => {
            const count = pm.grantManifestPermissions('plugin-a', ['network', 'filesystem']);
            expect(count).toBe(2);
            expect(pm.hasPermission('plugin-a', 'network')).toBe(true);
            expect(pm.hasPermission('plugin-a', 'filesystem')).toBe(true);
        });

        it('should revoke all permissions', () => {
            pm.grant('plugin-a', 'network');
            pm.grant('plugin-a', 'filesystem');
            const count = pm.revokeAll('plugin-a');
            expect(count).toBe(2);
            expect(pm.hasPermission('plugin-a', 'network')).toBe(false);
        });

        it('should remove plugin entirely', () => {
            pm.grant('plugin-a', 'network');
            pm.requestPermission('plugin-a', 'exec');
            pm.removePlugin('plugin-a');
            expect(pm.getPluginPermissions('plugin-a')).toHaveLength(0);
            expect(pm.getPluginRequests('plugin-a')).toHaveLength(0);
        });

        it('should return 0 when revoking from unknown plugin', () => {
            expect(pm.revokeAll('unknown')).toBe(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Events (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('events', () => {
        it('should emit grant event', () => {
            const events: PermissionChangeEvent[] = [];
            pm.onChange((e) => events.push(e));
            pm.grant('plugin-a', 'network');
            expect(events).toHaveLength(1);
            expect(events[0].type).toBe('grant');
        });

        it('should emit revoke event', () => {
            const events: string[] = [];
            pm.onChange((e) => events.push(e.type));
            pm.grant('plugin-a', 'network');
            pm.revoke('plugin-a', 'network');
            expect(events).toContain('revoke');
        });

        it('should emit request event', () => {
            const events: string[] = [];
            pm.onChange((e) => events.push(e.type));
            pm.requestPermission('plugin-a', 'network');
            expect(events).toContain('request');
        });

        it('should support unsubscribe', () => {
            const events: string[] = [];
            const unsub = pm.onChange((e) => events.push(e.type));
            unsub();
            pm.grant('plugin-a', 'network');
            expect(events).toHaveLength(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Summary & Stats (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('summary and stats', () => {
        it('should get plugin summary', () => {
            pm.grant('plugin-a', 'network');
            pm.deny('plugin-a', 'exec');
            pm.requestPermission('plugin-a', 'filesystem');
            const summary = pm.getPluginSummary('plugin-a');
            expect(summary.granted).toContain('network');
            expect(summary.denied).toContain('exec');
            expect(summary.pending).toContain('filesystem');
        });

        it('should get tracked plugins', () => {
            pm.grant('plugin-a', 'network');
            pm.grant('plugin-b', 'filesystem');
            expect(pm.getTrackedPlugins()).toHaveLength(2);
        });

        it('should get stats', () => {
            pm.grant('plugin-a', 'network');
            pm.deny('plugin-a', 'exec');
            const stats = pm.getStats();
            expect(stats.totalGrants).toBe(1);
            expect(stats.totalDenials).toBe(1);
            expect(stats.policy).toBe('prompt');
        });

        it('should report empty stats initially', () => {
            const stats = pm.getStats();
            expect(stats.totalPlugins).toBe(0);
            expect(stats.totalGrants).toBe(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Export / Import (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('export and import', () => {
        it('should export records', () => {
            pm.grant('plugin-a', 'network');
            pm.grant('plugin-a', 'filesystem');
            const exported = pm.exportRecords();
            expect(exported['plugin-a']).toHaveLength(2);
        });

        it('should import records', () => {
            pm.grant('plugin-a', 'network');
            const exported = pm.exportRecords();

            const newPm = new PermissionManager();
            const count = newPm.importRecords(exported);
            expect(count).toBe(1);
            expect(newPm.hasPermission('plugin-a', 'network')).toBe(true);
        });

        it('should clear all records', () => {
            pm.grant('plugin-a', 'network');
            pm.requestPermission('plugin-a', 'exec');
            pm.clear();
            expect(pm.getTrackedPlugins()).toHaveLength(0);
            expect(pm.getPendingRequests()).toHaveLength(0);
        });

        it('should export empty object for no records', () => {
            expect(pm.exportRecords()).toEqual({});
        });
    });

    // ════════════════════════════════════════════════════════════
    // Constants (1 test)
    // ════════════════════════════════════════════════════════════

    describe('constants', () => {
        it('should export all valid permissions', () => {
            expect(ALL_PERMISSIONS).toContain('network');
            expect(ALL_PERMISSIONS).toContain('filesystem');
            expect(ALL_PERMISSIONS).toContain('exec');
            expect(ALL_PERMISSIONS).toContain('env');
            expect(ALL_PERMISSIONS).toContain('secrets');
            expect(ALL_PERMISSIONS).toHaveLength(5);
        });
    });
});
