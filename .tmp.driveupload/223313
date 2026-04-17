/**
 * CoreBlow — Permission Resolver
 *
 * Resolves user permissions based on roles, groups,
 * resource-level ACLs, and inheritance.
 */

/** Permission */
export interface Permission {
    resource: string;
    action: string;
}

/** Role definition */
export interface RoleDefinition {
    name: string;
    permissions: Permission[];
    inherits?: string[];
}

/**
 * CoreBlow Permission Resolver
 */
export class PermissionResolver {
    private roles = new Map<string, RoleDefinition>();
    private userRoles = new Map<string, string[]>();
    private overrides = new Map<string, Permission[]>(); // user-level overrides

    /**
     * Define a role.
     */
    defineRole(name: string, permissions: Permission[], inherits?: string[]): void {
        this.roles.set(name, { name, permissions, inherits });
    }

    /**
     * Assign roles to a user.
     */
    assignRoles(userId: string, roles: string[]): void {
        this.userRoles.set(userId, roles);
    }

    /**
     * Add user-level permission override.
     */
    addOverride(userId: string, permissions: Permission[]): void {
        this.overrides.set(userId, permissions);
    }

    /**
     * Get all permissions for a user (including inherited).
     */
    resolve(userId: string): Permission[] {
        const roles = this.userRoles.get(userId) ?? [];
        const perms = new Set<string>();
        const result: Permission[] = [];

        const processRole = (roleName: string, visited: Set<string>) => {
            if (visited.has(roleName)) return;
            visited.add(roleName);
            const role = this.roles.get(roleName);
            if (!role) return;
            for (const perm of role.permissions) {
                const key = `${perm.resource}:${perm.action}`;
                if (!perms.has(key)) { perms.add(key); result.push(perm); }
            }
            if (role.inherits) {
                for (const parent of role.inherits) processRole(parent, visited);
            }
        };

        for (const role of roles) processRole(role, new Set());

        // Add overrides
        const overridePerms = this.overrides.get(userId) ?? [];
        for (const perm of overridePerms) {
            const key = `${perm.resource}:${perm.action}`;
            if (!perms.has(key)) { perms.add(key); result.push(perm); }
        }

        return result;
    }

    /**
     * Check if user has permission.
     */
    can(userId: string, resource: string, action: string): boolean {
        const perms = this.resolve(userId);
        return perms.some((p) =>
            (p.resource === resource || p.resource === '*') &&
            (p.action === action || p.action === '*')
        );
    }

    /**
     * List roles.
     */
    listRoles(): string[] { return Array.from(this.roles.keys()); }

    /** Count roles */
    count(): number { return this.roles.size; }
}
