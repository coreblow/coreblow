/**
 * CoreBlow Security — RBACSystem Test Suite
 *
 * Covers: built-in roles (owner/admin/user/guest), addRole(), removeRole(),
 * assignRole(), revokeRole(), can() with wildcard and resource permissions,
 * hierarchical role inheritance, getUserPermissions(), getUserRoles(),
 * listRoles(), and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RBACSystem } from './rbac.js';

describe('RBACSystem', () => {
    let rbac: RBACSystem;

    beforeEach(() => {
        rbac = new RBACSystem();
    });

    // ─── Default Roles ──────────────────────────────────────────

    describe('default roles', () => {
        it('has 4 built-in roles', () => {
            expect(rbac.listRoles().length).toBe(4);
        });

        it('includes owner, admin, user, guest', () => {
            const names = rbac.listRoles().map(r => r.name);
            expect(names).toContain('owner');
            expect(names).toContain('admin');
            expect(names).toContain('user');
            expect(names).toContain('guest');
        });

        it('owner has wildcard permissions', () => {
            rbac.assignRole('u1', 'owner');
            expect(rbac.can('u1', 'anything', 'any-action')).toBe(true);
            expect(rbac.can('u1', 'agents', 'delete')).toBe(true);
        });

        it('admin has agents read/write/execute, channels read/write, config read/write, users read', () => {
            rbac.assignRole('u1', 'admin');
            expect(rbac.can('u1', 'agents', 'read')).toBe(true);
            expect(rbac.can('u1', 'agents', 'write')).toBe(true);
            expect(rbac.can('u1', 'agents', 'execute')).toBe(true);
            expect(rbac.can('u1', 'channels', 'read')).toBe(true);
            expect(rbac.can('u1', 'channels', 'write')).toBe(true);
            expect(rbac.can('u1', 'config', 'write')).toBe(true);
            expect(rbac.can('u1', 'users', 'read')).toBe(true);
            expect(rbac.can('u1', 'users', 'write')).toBe(false);
        });

        it('user has agents read/execute, channels read', () => {
            rbac.assignRole('u1', 'user');
            expect(rbac.can('u1', 'agents', 'read')).toBe(true);
            expect(rbac.can('u1', 'agents', 'execute')).toBe(true);
            expect(rbac.can('u1', 'agents', 'write')).toBe(false);
            expect(rbac.can('u1', 'channels', 'read')).toBe(true);
            expect(rbac.can('u1', 'channels', 'write')).toBe(false);
        });

        it('guest has agents read only', () => {
            rbac.assignRole('u1', 'guest');
            expect(rbac.can('u1', 'agents', 'read')).toBe(true);
            expect(rbac.can('u1', 'agents', 'write')).toBe(false);
            expect(rbac.can('u1', 'agents', 'execute')).toBe(false);
            expect(rbac.can('u1', 'channels', 'read')).toBe(false);
        });
    });

    // ─── addRole() / removeRole() ───────────────────────────────

    describe('addRole() / removeRole()', () => {
        it('adds a custom role', () => {
            rbac.addRole({
                name: 'moderator',
                permissions: [{ resource: 'agents', actions: ['read', 'write'] }],
                description: 'Moderator',
            });
            expect(rbac.listRoles().find(r => r.name === 'moderator')).toBeTruthy();
        });

        it('overwrites existing role', () => {
            rbac.addRole({ name: 'guest', permissions: [{ resource: '*', actions: ['read'] }] });
            rbac.assignRole('u1', 'guest');
            expect(rbac.can('u1', 'config', 'read')).toBe(true);
        });

        it('removes a role', () => {
            expect(rbac.removeRole('guest')).toBe(true);
            expect(rbac.listRoles().find(r => r.name === 'guest')).toBeUndefined();
        });

        it('removeRole returns false for unknown role', () => {
            expect(rbac.removeRole('nonexistent')).toBe(false);
        });
    });

    // ─── assignRole() / revokeRole() ────────────────────────────

    describe('assignRole() / revokeRole()', () => {
        it('assigns role to user', () => {
            expect(rbac.assignRole('u1', 'user')).toBe(true);
            expect(rbac.getUserRoles('u1')).toContain('user');
        });

        it('creates user if not exists', () => {
            rbac.assignRole('new-user', 'guest');
            expect(rbac.getUserRoles('new-user')).toContain('guest');
        });

        it('does not duplicate role assignment', () => {
            rbac.assignRole('u1', 'user');
            rbac.assignRole('u1', 'user');
            expect(rbac.getUserRoles('u1').filter(r => r === 'user').length).toBe(1);
        });

        it('returns false for unknown role', () => {
            expect(rbac.assignRole('u1', 'nonexistent')).toBe(false);
        });

        it('assigns multiple roles to same user', () => {
            rbac.assignRole('u1', 'user');
            rbac.assignRole('u1', 'admin');
            expect(rbac.getUserRoles('u1')).toContain('user');
            expect(rbac.getUserRoles('u1')).toContain('admin');
        });

        it('revokes a role from user', () => {
            rbac.assignRole('u1', 'user');
            expect(rbac.revokeRole('u1', 'user')).toBe(true);
            expect(rbac.getUserRoles('u1')).not.toContain('user');
        });

        it('revokeRole returns false for unknown user', () => {
            expect(rbac.revokeRole('unknown', 'user')).toBe(false);
        });

        it('revokeRole returns false for unassigned role', () => {
            rbac.assignRole('u1', 'user');
            expect(rbac.revokeRole('u1', 'admin')).toBe(false);
        });
    });

    // ─── can() ──────────────────────────────────────────────────

    describe('can()', () => {
        it('returns false for unknown user', () => {
            expect(rbac.can('unknown', 'agents', 'read')).toBe(false);
        });

        it('checks across multiple assigned roles', () => {
            rbac.assignRole('u1', 'guest');
            expect(rbac.can('u1', 'channels', 'read')).toBe(false);

            rbac.assignRole('u1', 'user');
            expect(rbac.can('u1', 'channels', 'read')).toBe(true);
        });
    });

    // ─── Role Inheritance ───────────────────────────────────────

    describe('role inheritance', () => {
        it('inherits permissions from parent role', () => {
            rbac.addRole({
                name: 'super-admin',
                permissions: [{ resource: 'billing', actions: ['read', 'write'] }],
                inherits: ['admin'],
            });

            rbac.assignRole('u1', 'super-admin');
            // Own permissions
            expect(rbac.can('u1', 'billing', 'read')).toBe(true);
            // Inherited from admin
            expect(rbac.can('u1', 'agents', 'execute')).toBe(true);
            expect(rbac.can('u1', 'config', 'write')).toBe(true);
        });

        it('handles multi-level inheritance', () => {
            rbac.addRole({
                name: 'level-1',
                permissions: [{ resource: 'l1-resource', actions: ['read'] }],
            });
            rbac.addRole({
                name: 'level-2',
                permissions: [{ resource: 'l2-resource', actions: ['read'] }],
                inherits: ['level-1'],
            });
            rbac.addRole({
                name: 'level-3',
                permissions: [],
                inherits: ['level-2'],
            });

            rbac.assignRole('u1', 'level-3');
            expect(rbac.can('u1', 'l1-resource', 'read')).toBe(true);
            expect(rbac.can('u1', 'l2-resource', 'read')).toBe(true);
        });

        it('prevents circular inheritance (visited set)', () => {
            rbac.addRole({ name: 'roleA', permissions: [], inherits: ['roleB'] });
            rbac.addRole({ name: 'roleB', permissions: [], inherits: ['roleA'] });

            rbac.assignRole('u1', 'roleA');
            // Should not infinite loop
            expect(rbac.can('u1', 'anything', 'read')).toBe(false);
        });
    });

    // ─── getUserPermissions() ───────────────────────────────────

    describe('getUserPermissions()', () => {
        it('returns all permissions for assigned roles', () => {
            rbac.assignRole('u1', 'admin');
            const perms = rbac.getUserPermissions('u1');
            expect(perms.length).toBeGreaterThan(0);
            expect(perms.some(p => p.resource === 'agents')).toBe(true);
        });

        it('returns empty for unknown user', () => {
            expect(rbac.getUserPermissions('unknown')).toEqual([]);
        });

        it('includes inherited permissions', () => {
            rbac.addRole({
                name: 'custom',
                permissions: [{ resource: 'custom-res', actions: ['read'] }],
                inherits: ['user'],
            });
            rbac.assignRole('u1', 'custom');

            const perms = rbac.getUserPermissions('u1');
            expect(perms.some(p => p.resource === 'custom-res')).toBe(true);
            expect(perms.some(p => p.resource === 'agents')).toBe(true); // from 'user'
        });
    });

    // ─── getUserRoles() ─────────────────────────────────────────

    describe('getUserRoles()', () => {
        it('returns empty array for unknown user', () => {
            expect(rbac.getUserRoles('unknown')).toEqual([]);
        });

        it('returns assigned roles', () => {
            rbac.assignRole('u1', 'admin');
            rbac.assignRole('u1', 'user');
            expect(rbac.getUserRoles('u1')).toEqual(['admin', 'user']);
        });
    });

    // ─── listRoles() ────────────────────────────────────────────

    describe('listRoles()', () => {
        it('returns name, description, and permission count', () => {
            const roles = rbac.listRoles();
            for (const role of roles) {
                expect(role.name).toBeTruthy();
                expect(typeof role.permissionCount).toBe('number');
            }
        });
    });
});
