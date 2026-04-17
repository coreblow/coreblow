/**
 * CoreBlow — Tenant Manager
 *
 * Manages multi-tenant environments with tenant
 * registration, suspension, metadata, and isolation.
 */

/** Tenant */
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: 'active' | 'suspended' | 'trial' | 'deactivated';
    plan: string;
    createdAt: number;
    metadata?: Record<string, unknown>;
    limits: { maxUsers: number; maxChannels: number; maxAgents: number };
    userCount: number;
}

/**
 * CoreBlow Tenant Manager
 */
export class TenantManager {
    private tenants = new Map<string, Tenant>();
    private idCounter = 0;

    /**
     * Create a tenant.
     */
    create(name: string, plan: string = 'free', limits?: Partial<Tenant['limits']>): Tenant {
        const id = `tenant-${++this.idCounter}`;
        const tenant: Tenant = {
            id, name, slug: name.toLowerCase().replace(/\s+/g, '-'),
            status: 'active', plan, createdAt: Date.now(),
            limits: { maxUsers: limits?.maxUsers ?? 10, maxChannels: limits?.maxChannels ?? 3, maxAgents: limits?.maxAgents ?? 5 },
            userCount: 0,
        };
        this.tenants.set(id, tenant);
        return tenant;
    }

    /**
     * Get a tenant.
     */
    get(id: string): Tenant | null { return this.tenants.get(id) ?? null; }

    /**
     * Find by slug.
     */
    findBySlug(slug: string): Tenant | null {
        return Array.from(this.tenants.values()).find((t) => t.slug === slug) ?? null;
    }

    /**
     * Suspend a tenant.
     */
    suspend(id: string, reason?: string): boolean {
        const t = this.tenants.get(id);
        if (!t) return false;
        t.status = 'suspended';
        if (reason) t.metadata = { ...t.metadata, suspendReason: reason };
        return true;
    }

    /**
     * Reactivate a tenant.
     */
    activate(id: string): boolean {
        const t = this.tenants.get(id);
        if (!t) return false;
        t.status = 'active';
        return true;
    }

    /**
     * Update plan.
     */
    updatePlan(id: string, plan: string, limits?: Partial<Tenant['limits']>): boolean {
        const t = this.tenants.get(id);
        if (!t) return false;
        t.plan = plan;
        if (limits) t.limits = { ...t.limits, ...limits };
        return true;
    }

    /**
     * List tenants.
     */
    list(status?: Tenant['status']): Array<{ id: string; name: string; status: string; plan: string }> {
        return Array.from(this.tenants.values())
            .filter((t) => !status || t.status === status)
            .map((t) => ({ id: t.id, name: t.name, status: t.status, plan: t.plan }));
    }

    /**
     * Delete a tenant.
     */
    delete(id: string): boolean { return this.tenants.delete(id); }

    /** Count */
    count(): number { return this.tenants.size; }
}
