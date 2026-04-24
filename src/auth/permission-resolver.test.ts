import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionResolver } from './permission-resolver.js';

describe('PermissionResolver', () => {
    let resolver: PermissionResolver;

    beforeEach(() => {
        resolver = new PermissionResolver();
    });

    describe('defineRole + listRoles', () => {
        it('defines a role', () => {
            resolver.defineRole('admin', [{ resource: '*', action: '*' }]);
            expect(resolver.listRoles()).toContain('admin');
            expect(resolver.count()).toBe(1);
        });

        it('overwrites existing role', () => {
            resolver.defineRole('admin', [{ resource: '*', action: '*' }]);
            resolver.defineRole('admin', [{ resource: 'users', action: 'read' }]);
            expect(resolver.count()).toBe(1);
        });
    });

    describe('assignRoles + resolve', () => {
        it('resolves permissions from assigned roles', () => {
            resolver.defineRole('reader', [
                { resource: 'docs', action: 'read' },
                { resource: 'docs', action: 'list' },
            ]);
            resolver.assignRoles('user1', ['reader']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(2);
            expect(perms[0]).toEqual({ resource: 'docs', action: 'read' });
        });

        it('merges permissions from multiple roles', () => {
            resolver.defineRole('reader', [{ resource: 'docs', action: 'read' }]);
            resolver.defineRole('writer', [{ resource: 'docs', action: 'write' }]);
            resolver.assignRoles('user1', ['reader', 'writer']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(2);
        });

        it('deduplicates identical permissions', () => {
            resolver.defineRole('r1', [{ resource: 'docs', action: 'read' }]);
            resolver.defineRole('r2', [{ resource: 'docs', action: 'read' }]);
            resolver.assignRoles('user1', ['r1', 'r2']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(1);
        });

        it('returns empty for user with no roles', () => {
            expect(resolver.resolve('nobody')).toHaveLength(0);
        });
    });

    describe('role inheritance', () => {
        it('inherits parent permissions', () => {
            resolver.defineRole('base', [{ resource: 'docs', action: 'read' }]);
            resolver.defineRole('editor', [{ resource: 'docs', action: 'write' }], ['base']);
            resolver.assignRoles('user1', ['editor']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(2);
            expect(perms.some(p => p.action === 'read')).toBe(true);
            expect(perms.some(p => p.action === 'write')).toBe(true);
        });

        it('handles multi-level inheritance', () => {
            resolver.defineRole('base', [{ resource: 'system', action: 'read' }]);
            resolver.defineRole('editor', [{ resource: 'docs', action: 'write' }], ['base']);
            resolver.defineRole('admin', [{ resource: '*', action: '*' }], ['editor']);
            resolver.assignRoles('user1', ['admin']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(3);
        });

        it('handles circular inheritance gracefully', () => {
            resolver.defineRole('a', [{ resource: 'x', action: 'read' }], ['b']);
            resolver.defineRole('b', [{ resource: 'y', action: 'read' }], ['a']);
            resolver.assignRoles('user1', ['a']);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(2);
        });
    });

    describe('overrides', () => {
        it('adds user-level override permissions', () => {
            resolver.addOverride('user1', [{ resource: 'admin', action: 'delete' }]);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(1);
            expect(perms[0]).toEqual({ resource: 'admin', action: 'delete' });
        });

        it('merges overrides with role permissions', () => {
            resolver.defineRole('reader', [{ resource: 'docs', action: 'read' }]);
            resolver.assignRoles('user1', ['reader']);
            resolver.addOverride('user1', [{ resource: 'admin', action: 'delete' }]);
            const perms = resolver.resolve('user1');
            expect(perms).toHaveLength(2);
        });
    });

    describe('can', () => {
        beforeEach(() => {
            resolver.defineRole('reader', [{ resource: 'docs', action: 'read' }]);
            resolver.defineRole('admin', [{ resource: '*', action: '*' }]);
            resolver.assignRoles('user1', ['reader']);
            resolver.assignRoles('admin1', ['admin']);
        });

        it('allows matching permission', () => {
            expect(resolver.can('user1', 'docs', 'read')).toBe(true);
        });

        it('denies non-matching permission', () => {
            expect(resolver.can('user1', 'docs', 'delete')).toBe(false);
        });

        it('wildcard resource matches any resource', () => {
            expect(resolver.can('admin1', 'anything', 'anything')).toBe(true);
        });

        it('denies for user with no roles', () => {
            expect(resolver.can('nobody', 'docs', 'read')).toBe(false);
        });

        it('respects overrides', () => {
            resolver.addOverride('user1', [{ resource: 'admin', action: 'nuke' }]);
            expect(resolver.can('user1', 'admin', 'nuke')).toBe(true);
        });
    });
});
