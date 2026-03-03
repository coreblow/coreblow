import { describe, it, expect, beforeEach } from 'vitest';
import { RBACSystem } from './rbac.js';
import type { Role, Permission, RBACUser } from './rbac.js';

describe('RBACSystem', () => {
    let rbac: RBACSystem;

    beforeEach(() => {
        rbac = new RBACSystem();
    });

    // ───────────────────────────────────────────────────────
    // 1. Built-in Role Initialization
    // ───────────────────────────────────────────────────────

    describe('built-in roles', () => {
        it('should register 4 built-in roles on construction', () => {
            const roles = rbac.listRoles();
            expect(roles).toHaveLength(4);
            const names = roles.map((r) => r.name);
            expect(names).toContain('owner');
            expect(names).toContain('admin');
            expect(names).toContain('user');
            expect(names).toContain('guest');
        });

        it('owner should have wildcard resource and wildcard action', () => {
            const roles = rbac.listRoles();
            const owner = roles.find((r) => r.name === 'owner');
            expect(owner).toBeDefined();
            expect(owner!.description).toBe('Full access to everything');
            expect(owner!.permissionCount).toBe(1);
        });

        it('admin should have 4 resource permissions', () => {
            const admin = rbac.listRoles().find((r) => r.name === 'admin');
            expect(admin).toBeDefined();
            expect(admin!.permissionCount).toBe(4);
            expect(admin!.description).toBe('Administrative access');
        });

        it('user should have 2 resource permissions', () => {
            const user = rbac.listRoles().find((r) => r.name === 'user');
            expect(user).toBeDefined();
            expect(user!.permissionCount).toBe(2);
        });

        it('guest should have 1 resource permission (agents:read only)', () => {
            const guest = rbac.listRoles().find((r) => r.name === 'guest');
            expect(guest).toBeDefined();
            expect(guest!.permissionCount).toBe(1);
        });
    });

    // ───────────────────────────────────────────────────────
    // 2. Role CRUD — addRole / removeRole / listRoles
    // ───────────────────────────────────────────────────────

    describe('addRole', () => {
        it('should add a custom role', () => {
            rbac.addRole({
                name: 'editor',
                permissions: [{ resource: 'docs', actions: ['read', 'write'] }],
                description: 'Document editor',
            });
            const roles = rbac.listRoles();
            expect(roles).toHaveLength(5);
            const editor = roles.find((r) => r.name === 'editor');
            expect(editor).toBeDefined();
            expect(editor!.permissionCount).toBe(1);
            expect(editor!.description).toBe('Document editor');
        });

        it('should overwrite an existing role with the same name', () => {
            rbac.addRole({
                name: 'guest',
                permissions: [
                    { resource: 'agents', actions: ['read'] },
                    { resource: 'docs', actions: ['read'] },
                ],
                description: 'Updated guest',
            });
            const guest = rbac.listRoles().find((r) => r.name === 'guest');
            expect(guest!.permissionCount).toBe(2);
            expect(guest!.description).toBe('Updated guest');
        });

        it('should accept a role with no description', () => {
            rbac.addRole({
                name: 'minimal',
                permissions: [],
            });
            const role = rbac.listRoles().find((r) => r.name === 'minimal');
            expect(role).toBeDefined();
            expect(role!.description).toBeUndefined();
            expect(role!.permissionCount).toBe(0);
        });
    });

    describe('removeRole', () => {
        it('should remove an existing role and return true', () => {
            expect(rbac.removeRole('guest')).toBe(true);
            const names = rbac.listRoles().map((r) => r.name);
            expect(names).not.toContain('guest');
            expect(rbac.listRoles()).toHaveLength(3);
        });

        it('should return false when removing a non-existent role', () => {
            expect(rbac.removeRole('nonexistent')).toBe(false);
        });

        it('should not affect other roles when one is removed', () => {
            rbac.removeRole('guest');
            const names = rbac.listRoles().map((r) => r.name);
            expect(names).toContain('owner');
            expect(names).toContain('admin');
            expect(names).toContain('user');
        });
    });

    describe('listRoles', () => {
        it('should return correct shape for each role entry', () => {
            const roles = rbac.listRoles();
            for (const role of roles) {
                expect(role).toHaveProperty('name');
                expect(role).toHaveProperty('permissionCount');
                expect(typeof role.name).toBe('string');
                expect(typeof role.permissionCount).toBe('number');
            }
        });
    });

    // ───────────────────────────────────────────────────────
    // 3. User-Role Assignment & Revocation
    // ───────────────────────────────────────────────────────

    describe('assignRole', () => {
        it('should assign a valid role to a new user and return true', () => {
            expect(rbac.assignRole('user-1', 'admin')).toBe(true);
            expect(rbac.getUserRoles('user-1')).toEqual(['admin']);
        });

        it('should auto-create user record on first assignment', () => {
            rbac.assignRole('new-user', 'guest');
            expect(rbac.getUserRoles('new-user')).toEqual(['guest']);
        });

        it('should allow assigning multiple roles to the same user', () => {
            rbac.assignRole('user-1', 'user');
            rbac.assignRole('user-1', 'admin');
            expect(rbac.getUserRoles('user-1')).toEqual(['user', 'admin']);
        });

        it('should not duplicate a role already assigned', () => {
            rbac.assignRole('user-1', 'admin');
            rbac.assignRole('user-1', 'admin');
            expect(rbac.getUserRoles('user-1')).toEqual(['admin']);
        });

        it('should return false when assigning a non-existent role', () => {
            expect(rbac.assignRole('user-1', 'nonexistent')).toBe(false);
        });

        it('should not create user record when role does not exist', () => {
            rbac.assignRole('ghost', 'nonexistent');
            expect(rbac.getUserRoles('ghost')).toEqual([]);
        });
    });

    describe('revokeRole', () => {
        it('should revoke an assigned role and return true', () => {
            rbac.assignRole('user-1', 'admin');
            rbac.assignRole('user-1', 'user');
            expect(rbac.revokeRole('user-1', 'admin')).toBe(true);
            expect(rbac.getUserRoles('user-1')).toEqual(['user']);
        });

        it('should return false when revoking from a non-existent user', () => {
            expect(rbac.revokeRole('nonexistent', 'admin')).toBe(false);
        });

        it('should return false when revoking a role the user does not have', () => {
            rbac.assignRole('user-1', 'guest');
            expect(rbac.revokeRole('user-1', 'admin')).toBe(false);
        });

        it('should leave user with no roles after revoking all', () => {
            rbac.assignRole('user-1', 'guest');
            rbac.revokeRole('user-1', 'guest');
            expect(rbac.getUserRoles('user-1')).toEqual([]);
        });
    });

    describe('getUserRoles', () => {
        it('should return empty array for unknown user', () => {
            expect(rbac.getUserRoles('phantom')).toEqual([]);
        });

        it('should return all assigned roles in order', () => {
            rbac.assignRole('user-1', 'guest');
            rbac.assignRole('user-1', 'user');
            rbac.assignRole('user-1', 'admin');
            expect(rbac.getUserRoles('user-1')).toEqual(['guest', 'user', 'admin']);
        });
    });

    // ───────────────────────────────────────────────────────
    // 4. Permission Checks — can()
    // ───────────────────────────────────────────────────────

    describe('can — happy path', () => {
        it('owner should have access to any resource/action (wildcard)', () => {
            rbac.assignRole('boss', 'owner');
            expect(rbac.can('boss', 'agents', 'read')).toBe(true);
            expect(rbac.can('boss', 'agents', 'write')).toBe(true);
            expect(rbac.can('boss', 'agents', 'execute')).toBe(true);
            expect(rbac.can('boss', 'channels', 'read')).toBe(true);
            expect(rbac.can('boss', 'channels', 'write')).toBe(true);
            expect(rbac.can('boss', 'config', 'read')).toBe(true);
            expect(rbac.can('boss', 'config', 'write')).toBe(true);
            expect(rbac.can('boss', 'users', 'read')).toBe(true);
            expect(rbac.can('boss', 'users', 'delete')).toBe(true);
            expect(rbac.can('boss', 'arbitrary-resource', 'arbitrary-action')).toBe(true);
        });

        it('admin should have agents:read, agents:write, agents:execute', () => {
            rbac.assignRole('adm', 'admin');
            expect(rbac.can('adm', 'agents', 'read')).toBe(true);
            expect(rbac.can('adm', 'agents', 'write')).toBe(true);
            expect(rbac.can('adm', 'agents', 'execute')).toBe(true);
        });

        it('admin should have channels:read, channels:write', () => {
            rbac.assignRole('adm', 'admin');
            expect(rbac.can('adm', 'channels', 'read')).toBe(true);
            expect(rbac.can('adm', 'channels', 'write')).toBe(true);
        });

        it('admin should have config:read, config:write', () => {
            rbac.assignRole('adm', 'admin');
            expect(rbac.can('adm', 'config', 'read')).toBe(true);
            expect(rbac.can('adm', 'config', 'write')).toBe(true);
        });

        it('admin should have users:read but NOT users:write', () => {
            rbac.assignRole('adm', 'admin');
            expect(rbac.can('adm', 'users', 'read')).toBe(true);
            expect(rbac.can('adm', 'users', 'write')).toBe(false);
        });

        it('user should have agents:read and agents:execute', () => {
            rbac.assignRole('usr', 'user');
            expect(rbac.can('usr', 'agents', 'read')).toBe(true);
            expect(rbac.can('usr', 'agents', 'execute')).toBe(true);
        });

        it('user should have channels:read but NOT channels:write', () => {
            rbac.assignRole('usr', 'user');
            expect(rbac.can('usr', 'channels', 'read')).toBe(true);
            expect(rbac.can('usr', 'channels', 'write')).toBe(false);
        });

        it('guest should only have agents:read', () => {
            rbac.assignRole('g', 'guest');
            expect(rbac.can('g', 'agents', 'read')).toBe(true);
        });
    });

    describe('can — deny path', () => {
        it('should deny all permissions for unknown user', () => {
            expect(rbac.can('nobody', 'agents', 'read')).toBe(false);
        });

        it('guest should NOT have agents:write', () => {
            rbac.assignRole('g', 'guest');
            expect(rbac.can('g', 'agents', 'write')).toBe(false);
        });

        it('guest should NOT have agents:execute', () => {
            rbac.assignRole('g', 'guest');
            expect(rbac.can('g', 'agents', 'execute')).toBe(false);
        });

        it('guest should NOT have channels:read', () => {
            rbac.assignRole('g', 'guest');
            expect(rbac.can('g', 'channels', 'read')).toBe(false);
        });

        it('guest should NOT have config:write', () => {
            rbac.assignRole('g', 'guest');
            expect(rbac.can('g', 'config', 'write')).toBe(false);
        });

        it('user should NOT have agents:write', () => {
            rbac.assignRole('usr', 'user');
            expect(rbac.can('usr', 'agents', 'write')).toBe(false);
        });

        it('user should NOT have config:read', () => {
            rbac.assignRole('usr', 'user');
            expect(rbac.can('usr', 'config', 'read')).toBe(false);
        });

        it('admin should NOT have access to an unknown resource', () => {
            rbac.assignRole('adm', 'admin');
            expect(rbac.can('adm', 'billing', 'read')).toBe(false);
        });

        it('should deny permission after role is revoked', () => {
            rbac.assignRole('usr', 'admin');
            expect(rbac.can('usr', 'config', 'write')).toBe(true);
            rbac.revokeRole('usr', 'admin');
            expect(rbac.can('usr', 'config', 'write')).toBe(false);
        });

        it('should deny permission after role is removed from the system', () => {
            rbac.assignRole('usr', 'admin');
            expect(rbac.can('usr', 'config', 'write')).toBe(true);
            rbac.removeRole('admin');
            // User still has 'admin' in their roles array, but the role definition is gone
            expect(rbac.can('usr', 'config', 'write')).toBe(false);
        });
    });

    describe('can — multi-role accumulation', () => {
        it('user with both guest and admin roles should have union of permissions', () => {
            rbac.assignRole('multi', 'guest');
            rbac.assignRole('multi', 'admin');
            // From admin
            expect(rbac.can('multi', 'config', 'write')).toBe(true);
            // From guest (also covered by admin)
            expect(rbac.can('multi', 'agents', 'read')).toBe(true);
        });

        it('user with no roles should have no permissions', () => {
            rbac.assignRole('empty', 'guest');
            rbac.revokeRole('empty', 'guest');
            expect(rbac.can('empty', 'agents', 'read')).toBe(false);
        });
    });

    // ───────────────────────────────────────────────────────
    // 5. Hierarchical Role Inheritance
    // ───────────────────────────────────────────────────────

    describe('role inheritance — single level', () => {
        it('should inherit permissions from a parent role', () => {
            rbac.addRole({
                name: 'super-admin',
                permissions: [{ resource: 'billing', actions: ['read', 'write'] }],
                inherits: ['admin'],
                description: 'Admin + billing',
            });
            rbac.assignRole('sa', 'super-admin');

            // Direct perm from super-admin
            expect(rbac.can('sa', 'billing', 'read')).toBe(true);
            expect(rbac.can('sa', 'billing', 'write')).toBe(true);

            // Inherited from admin
            expect(rbac.can('sa', 'agents', 'read')).toBe(true);
            expect(rbac.can('sa', 'agents', 'write')).toBe(true);
            expect(rbac.can('sa', 'agents', 'execute')).toBe(true);
            expect(rbac.can('sa', 'channels', 'read')).toBe(true);
            expect(rbac.can('sa', 'channels', 'write')).toBe(true);
            expect(rbac.can('sa', 'config', 'read')).toBe(true);
            expect(rbac.can('sa', 'config', 'write')).toBe(true);
            expect(rbac.can('sa', 'users', 'read')).toBe(true);
        });

        it('should NOT grant access outside inherited permissions', () => {
            rbac.addRole({
                name: 'super-admin',
                permissions: [{ resource: 'billing', actions: ['read'] }],
                inherits: ['admin'],
            });
            rbac.assignRole('sa', 'super-admin');
            // admin doesn't have users:write, billing:write is not in super-admin
            expect(rbac.can('sa', 'users', 'write')).toBe(false);
        });
    });

    describe('role inheritance — multi level', () => {
        it('should resolve transitive inheritance (grandparent)', () => {
            rbac.addRole({
                name: 'moderator',
                permissions: [{ resource: 'reports', actions: ['read', 'write'] }],
                inherits: ['user'],
            });
            rbac.addRole({
                name: 'senior-mod',
                permissions: [{ resource: 'reports', actions: ['delete'] }],
                inherits: ['moderator'],
            });
            rbac.assignRole('sm', 'senior-mod');

            // Direct from senior-mod
            expect(rbac.can('sm', 'reports', 'delete')).toBe(true);
            // From moderator
            expect(rbac.can('sm', 'reports', 'read')).toBe(true);
            expect(rbac.can('sm', 'reports', 'write')).toBe(true);
            // From user (grandparent)
            expect(rbac.can('sm', 'agents', 'read')).toBe(true);
            expect(rbac.can('sm', 'agents', 'execute')).toBe(true);
            expect(rbac.can('sm', 'channels', 'read')).toBe(true);
        });

        it('should handle multiple inheritance (diamond)', () => {
            rbac.addRole({
                name: 'role-a',
                permissions: [{ resource: 'feature-a', actions: ['read'] }],
            });
            rbac.addRole({
                name: 'role-b',
                permissions: [{ resource: 'feature-b', actions: ['write'] }],
            });
            rbac.addRole({
                name: 'role-c',
                permissions: [],
                inherits: ['role-a', 'role-b'],
            });
            rbac.assignRole('u', 'role-c');

            expect(rbac.can('u', 'feature-a', 'read')).toBe(true);
            expect(rbac.can('u', 'feature-b', 'write')).toBe(true);
            expect(rbac.can('u', 'feature-a', 'write')).toBe(false);
            expect(rbac.can('u', 'feature-b', 'read')).toBe(false);
        });
    });

    describe('role inheritance — circular guard', () => {
        it('should NOT infinite loop on circular inheritance', () => {
            rbac.addRole({
                name: 'circle-a',
                permissions: [{ resource: 'x', actions: ['read'] }],
                inherits: ['circle-b'],
            });
            rbac.addRole({
                name: 'circle-b',
                permissions: [{ resource: 'y', actions: ['read'] }],
                inherits: ['circle-a'],
            });
            rbac.assignRole('cyc', 'circle-a');

            // Should resolve without hanging
            expect(rbac.can('cyc', 'x', 'read')).toBe(true);
            expect(rbac.can('cyc', 'y', 'read')).toBe(true);
            expect(rbac.can('cyc', 'z', 'read')).toBe(false);
        });

        it('should NOT infinite loop on self-referencing inheritance', () => {
            rbac.addRole({
                name: 'self-ref',
                permissions: [{ resource: 'self', actions: ['read'] }],
                inherits: ['self-ref'],
            });
            rbac.assignRole('sr', 'self-ref');
            expect(rbac.can('sr', 'self', 'read')).toBe(true);
            expect(rbac.can('sr', 'other', 'read')).toBe(false);
        });
    });

    describe('role inheritance — inheriting non-existent parent', () => {
        it('should gracefully ignore non-existent parent roles', () => {
            rbac.addRole({
                name: 'orphan',
                permissions: [{ resource: 'data', actions: ['read'] }],
                inherits: ['does-not-exist'],
            });
            rbac.assignRole('o', 'orphan');
            expect(rbac.can('o', 'data', 'read')).toBe(true);
            expect(rbac.can('o', 'agents', 'read')).toBe(false);
        });
    });

    // ───────────────────────────────────────────────────────
    // 6. getUserPermissions
    // ───────────────────────────────────────────────────────

    describe('getUserPermissions', () => {
        it('should return empty array for unknown user', () => {
            expect(rbac.getUserPermissions('nobody')).toEqual([]);
        });

        it('should return direct permissions for a user with one role', () => {
            rbac.assignRole('g', 'guest');
            const perms = rbac.getUserPermissions('g');
            expect(perms).toHaveLength(1);
            expect(perms[0]).toEqual({ resource: 'agents', actions: ['read'] });
        });

        it('should aggregate permissions from multiple roles', () => {
            rbac.assignRole('multi', 'guest');
            rbac.assignRole('multi', 'admin');
            const perms = rbac.getUserPermissions('multi');
            // guest: 1 perm, admin: 4 perms
            expect(perms).toHaveLength(5);
        });

        it('should include inherited permissions', () => {
            rbac.addRole({
                name: 'super-admin',
                permissions: [{ resource: 'billing', actions: ['read'] }],
                inherits: ['admin'],
            });
            rbac.assignRole('sa', 'super-admin');
            const perms = rbac.getUserPermissions('sa');
            // 1 (billing) + 4 (admin inherited) = 5
            expect(perms).toHaveLength(5);
            const resources = perms.map((p) => p.resource);
            expect(resources).toContain('billing');
            expect(resources).toContain('agents');
            expect(resources).toContain('channels');
            expect(resources).toContain('config');
            expect(resources).toContain('users');
        });

        it('should NOT duplicate when circular inheritance is present', () => {
            rbac.addRole({
                name: 'loop-a',
                permissions: [{ resource: 'x', actions: ['read'] }],
                inherits: ['loop-b'],
            });
            rbac.addRole({
                name: 'loop-b',
                permissions: [{ resource: 'y', actions: ['write'] }],
                inherits: ['loop-a'],
            });
            rbac.assignRole('looper', 'loop-a');
            const perms = rbac.getUserPermissions('looper');
            // loop-a: x:read, then visit loop-b: y:write, then loop-a already visited → stop
            expect(perms).toHaveLength(2);
        });

        it('should return empty for user with all roles revoked', () => {
            rbac.assignRole('u', 'guest');
            rbac.revokeRole('u', 'guest');
            expect(rbac.getUserPermissions('u')).toEqual([]);
        });
    });

    // ───────────────────────────────────────────────────────
    // 7. Wildcard Matching Edge Cases
    // ───────────────────────────────────────────────────────

    describe('wildcard permissions', () => {
        it('resource:* should match any resource', () => {
            rbac.assignRole('o', 'owner');
            expect(rbac.can('o', 'anything', 'read')).toBe(true);
            expect(rbac.can('o', 'custom-resource-123', 'custom-action')).toBe(true);
        });

        it('action:* should match any action on the specified resource', () => {
            rbac.addRole({
                name: 'agent-god',
                permissions: [{ resource: 'agents', actions: ['*'] }],
            });
            rbac.assignRole('ag', 'agent-god');
            expect(rbac.can('ag', 'agents', 'read')).toBe(true);
            expect(rbac.can('ag', 'agents', 'write')).toBe(true);
            expect(rbac.can('ag', 'agents', 'delete')).toBe(true);
            expect(rbac.can('ag', 'agents', 'any-action')).toBe(true);
            // But NOT on a different resource
            expect(rbac.can('ag', 'channels', 'read')).toBe(false);
        });

        it('resource:* + action:* should grant universal access', () => {
            rbac.addRole({
                name: 'god-mode',
                permissions: [{ resource: '*', actions: ['*'] }],
            });
            rbac.assignRole('god', 'god-mode');
            expect(rbac.can('god', 'any', 'thing')).toBe(true);
        });
    });

    // ───────────────────────────────────────────────────────
    // 8. System Integrity — Role lifecycle interactions
    // ───────────────────────────────────────────────────────

    describe('system integrity', () => {
        it('removing a role does not crash can() for users who had it', () => {
            rbac.assignRole('u1', 'admin');
            rbac.removeRole('admin');
            // Should return false, not throw
            expect(rbac.can('u1', 'agents', 'read')).toBe(false);
        });

        it('re-adding a removed role should restore permission checks', () => {
            rbac.assignRole('u1', 'admin');
            rbac.removeRole('admin');
            expect(rbac.can('u1', 'agents', 'read')).toBe(false);

            // Add it back with same permissions
            rbac.addRole({
                name: 'admin',
                permissions: [
                    { resource: 'agents', actions: ['read', 'write', 'execute'] },
                ],
            });
            // User still has 'admin' in their roles array
            expect(rbac.can('u1', 'agents', 'read')).toBe(true);
        });

        it('updating a role definition should immediately affect permission checks', () => {
            rbac.assignRole('u1', 'guest');
            expect(rbac.can('u1', 'agents', 'write')).toBe(false);

            // Upgrade guest permissions
            rbac.addRole({
                name: 'guest',
                permissions: [{ resource: 'agents', actions: ['read', 'write'] }],
            });
            expect(rbac.can('u1', 'agents', 'write')).toBe(true);
        });

        it('multiple RBAC instances should be independent', () => {
            const rbac2 = new RBACSystem();
            rbac.assignRole('shared-id', 'owner');
            expect(rbac.can('shared-id', 'agents', 'read')).toBe(true);
            expect(rbac2.can('shared-id', 'agents', 'read')).toBe(false);
        });
    });
});
