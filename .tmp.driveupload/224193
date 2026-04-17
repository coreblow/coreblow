/**
 * CoreBlow — RBAC (Role-Based Access Control)
 *
 * Fine-grained permission system with roles, permissions,
 * resource-level access, and hierarchical role inheritance.
 */

/** Permission definition */
export interface Permission {
    resource: string;
    actions: string[];
}

/** Role definition */
export interface Role {
    name: string;
    permissions: Permission[];
    inherits?: string[];
    description?: string;
}

/** User with assigned roles */
export interface RBACUser {
    id: string;
    roles: string[];
    metadata?: Record<string, unknown>;
}

/**
 * CoreBlow RBAC System
 */
export class RBACSystem {
    private roles = new Map<string, Role>();
    private users = new Map<string, RBACUser>();

    constructor() {
        // Built-in roles
        this.addRole({
            name: 'owner',
            permissions: [{ resource: '*', actions: ['*'] }],
            description: 'Full access to everything',
        });
        this.addRole({
            name: 'admin',
            permissions: [
                { resource: 'agents', actions: ['read', 'write', 'execute'] },
                { resource: 'channels', actions: ['read', 'write'] },
                { resource: 'config', actions: ['read', 'write'] },
                { resource: 'users', actions: ['read'] },
            ],
            description: 'Administrative access',
        });
        this.addRole({
            name: 'user',
            permissions: [
                { resource: 'agents', actions: ['read', 'execute'] },
                { resource: 'channels', actions: ['read'] },
            ],
            description: 'Standard user access',
        });
        this.addRole({
            name: 'guest',
            permissions: [
                { resource: 'agents', actions: ['read'] },
            ],
            description: 'Read-only guest access',
        });
    }

    /**
     * Add or update a role.
     */
    addRole(role: Role): void {
        this.roles.set(role.name, role);
    }

    /**
     * Remove a role.
     */
    removeRole(name: string): boolean {
        return this.roles.delete(name);
    }

    /**
     * Assign a role to a user.
     */
    assignRole(userId: string, roleName: string): boolean {
        if (!this.roles.has(roleName)) return false;
        let user = this.users.get(userId);
        if (!user) {
            user = { id: userId, roles: [] };
            this.users.set(userId, user);
        }
        if (!user.roles.includes(roleName)) {
            user.roles.push(roleName);
        }
        return true;
    }

    /**
     * Revoke a role from a user.
     */
    revokeRole(userId: string, roleName: string): boolean {
        const user = this.users.get(userId);
        if (!user) return false;
        const idx = user.roles.indexOf(roleName);
        if (idx === -1) return false;
        user.roles.splice(idx, 1);
        return true;
    }

    /**
     * Check if user has permission.
     */
    can(userId: string, resource: string, action: string): boolean {
        const user = this.users.get(userId);
        if (!user) return false;

        for (const roleName of user.roles) {
            if (this.roleHasPermission(roleName, resource, action, new Set())) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get all permissions for a user.
     */
    getUserPermissions(userId: string): Permission[] {
        const user = this.users.get(userId);
        if (!user) return [];

        const permissions: Permission[] = [];
        for (const roleName of user.roles) {
            permissions.push(...this.getRolePermissions(roleName, new Set()));
        }
        return permissions;
    }

    /**
     * Get user roles.
     */
    getUserRoles(userId: string): string[] {
        return this.users.get(userId)?.roles ?? [];
    }

    /**
     * List all roles.
     */
    listRoles(): Array<{ name: string; description?: string; permissionCount: number }> {
        return Array.from(this.roles.values()).map((r) => ({
            name: r.name,
            description: r.description,
            permissionCount: r.permissions.length,
        }));
    }

    // === Private ===

    private roleHasPermission(roleName: string, resource: string, action: string, visited: Set<string>): boolean {
        if (visited.has(roleName)) return false;
        visited.add(roleName);

        const role = this.roles.get(roleName);
        if (!role) return false;

        for (const perm of role.permissions) {
            if ((perm.resource === '*' || perm.resource === resource) &&
                (perm.actions.includes('*') || perm.actions.includes(action))) {
                return true;
            }
        }

        // Check inherited roles
        if (role.inherits) {
            for (const parent of role.inherits) {
                if (this.roleHasPermission(parent, resource, action, visited)) return true;
            }
        }

        return false;
    }

    private getRolePermissions(roleName: string, visited: Set<string>): Permission[] {
        if (visited.has(roleName)) return [];
        visited.add(roleName);

        const role = this.roles.get(roleName);
        if (!role) return [];

        const perms = [...role.permissions];
        if (role.inherits) {
            for (const parent of role.inherits) {
                perms.push(...this.getRolePermissions(parent, visited));
            }
        }
        return perms;
    }
}
