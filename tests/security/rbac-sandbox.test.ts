/**
 * tests/security/rbac-sandbox.test.ts
 * Tests for RBAC role hierarchy and sandbox isolation.
 */
import { describe, it, expect } from 'vitest';
import { RBACSystem } from '../../src/security/rbac.js';

describe('RBACSystem', () => {
    it('should have built-in roles', () => {
        const rbac = new RBACSystem();
        const roles = rbac.listRoles();
        const names = roles.map(r => r.name);
        expect(names).toContain('owner');
        expect(names).toContain('admin');
        expect(names).toContain('user');
        expect(names).toContain('guest');
    });

    it('owner can do everything', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u1', 'owner');
        expect(rbac.can('u1', 'agents', 'read')).toBe(true);
        expect(rbac.can('u1', 'config', 'write')).toBe(true);
        expect(rbac.can('u1', 'users', 'delete')).toBe(true);
    });

    it('admin can manage agents and channels', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u2', 'admin');
        expect(rbac.can('u2', 'agents', 'execute')).toBe(true);
        expect(rbac.can('u2', 'channels', 'write')).toBe(true);
    });

    it('user can read and execute agents only', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u3', 'user');
        expect(rbac.can('u3', 'agents', 'read')).toBe(true);
        expect(rbac.can('u3', 'agents', 'execute')).toBe(true);
        expect(rbac.can('u3', 'config', 'write')).toBe(false);
    });

    it('guest can only read agents', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u4', 'guest');
        expect(rbac.can('u4', 'agents', 'read')).toBe(true);
        expect(rbac.can('u4', 'agents', 'execute')).toBe(false);
        expect(rbac.can('u4', 'channels', 'read')).toBe(false);
    });

    it('unknown user has no permissions', () => {
        const rbac = new RBACSystem();
        expect(rbac.can('ghost', 'agents', 'read')).toBe(false);
    });

    it('should assign and revoke roles', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u5', 'admin');
        expect(rbac.getUserRoles('u5')).toContain('admin');
        rbac.revokeRole('u5', 'admin');
        expect(rbac.getUserRoles('u5')).not.toContain('admin');
    });

    it('should not assign non-existent role', () => {
        const rbac = new RBACSystem();
        expect(rbac.assignRole('u6', 'superadmin')).toBe(false);
    });

    it('should support role inheritance', () => {
        const rbac = new RBACSystem();
        rbac.addRole({
            name: 'moderator',
            permissions: [{ resource: 'chat', actions: ['moderate'] }],
            inherits: ['user'],
        });
        rbac.assignRole('u7', 'moderator');
        expect(rbac.can('u7', 'chat', 'moderate')).toBe(true);
        expect(rbac.can('u7', 'agents', 'read')).toBe(true); // inherited from user
    });

    it('should get user permissions', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u8', 'admin');
        const perms = rbac.getUserPermissions('u8');
        expect(perms.length).toBeGreaterThan(0);
    });

    it('should handle multiple roles per user', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u9', 'user');
        rbac.assignRole('u9', 'admin');
        expect(rbac.can('u9', 'config', 'write')).toBe(true); // from admin
        expect(rbac.can('u9', 'agents', 'read')).toBe(true); // from both
    });

    it('should add and remove custom roles', () => {
        const rbac = new RBACSystem();
        rbac.addRole({ name: 'custom', permissions: [{ resource: 'tools', actions: ['use'] }] });
        expect(rbac.listRoles().some(r => r.name === 'custom')).toBe(true);
        rbac.removeRole('custom');
        expect(rbac.listRoles().some(r => r.name === 'custom')).toBe(false);
    });

    it('should not duplicate role assignments', () => {
        const rbac = new RBACSystem();
        rbac.assignRole('u10', 'user');
        rbac.assignRole('u10', 'user');
        expect(rbac.getUserRoles('u10').filter(r => r === 'user')).toHaveLength(1);
    });
});
