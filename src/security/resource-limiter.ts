/**
 * CoreBlow — Resource Limiter
 *
 * Enforces resource limits per tenant or user.
 * Tracks CPU time, memory, storage, and API call
 * budgets with soft/hard limits.
 */

/** Resource limits */
export interface ResourceLimits {
    maxCpuMs: number;
    maxMemoryMB: number;
    maxStorageMB: number;
    maxApiCalls: number;
}

/** Resource usage */
export interface ResourceUsage {
    id: string;
    cpuMs: number;
    memoryMB: number;
    storageMB: number;
    apiCalls: number;
    limits: ResourceLimits;
    warnings: string[];
}

/**
 * CoreBlow Resource Limiter
 */
export class ResourceLimiter {
    private usage = new Map<string, ResourceUsage>();
    private defaultLimits: ResourceLimits = { maxCpuMs: 60_000, maxMemoryMB: 512, maxStorageMB: 1024, maxApiCalls: 10_000 };

    /**
     * Set limits for an entity.
     */
    setLimits(id: string, limits: Partial<ResourceLimits>): void {
        const u = this.getOrCreate(id);
        u.limits = { ...u.limits, ...limits };
    }

    /**
     * Record resource usage.
     */
    record(id: string, resource: 'cpu' | 'memory' | 'storage' | 'api', amount: number): { allowed: boolean; warning?: string } {
        const u = this.getOrCreate(id);
        switch (resource) {
            case 'cpu': u.cpuMs += amount; break;
            case 'memory': u.memoryMB = Math.max(u.memoryMB, amount); break;
            case 'storage': u.storageMB += amount; break;
            case 'api': u.apiCalls += amount; break;
        }
        return this.checkLimits(u, resource);
    }

    /**
     * Check if within limits.
     */
    isWithinLimits(id: string): boolean {
        const u = this.usage.get(id);
        if (!u) return true;
        return u.cpuMs <= u.limits.maxCpuMs && u.memoryMB <= u.limits.maxMemoryMB &&
            u.storageMB <= u.limits.maxStorageMB && u.apiCalls <= u.limits.maxApiCalls;
    }

    /**
     * Get usage.
     */
    getUsage(id: string): ResourceUsage | null { return this.usage.get(id) ?? null; }

    /**
     * Get usage percentage.
     */
    getPercentage(id: string): Record<string, number> | null {
        const u = this.usage.get(id);
        if (!u) return null;
        return {
            cpu: (u.cpuMs / u.limits.maxCpuMs) * 100,
            memory: (u.memoryMB / u.limits.maxMemoryMB) * 100,
            storage: (u.storageMB / u.limits.maxStorageMB) * 100,
            api: (u.apiCalls / u.limits.maxApiCalls) * 100,
        };
    }

    /**
     * Reset usage.
     */
    reset(id: string): boolean {
        const u = this.usage.get(id);
        if (!u) return false;
        u.cpuMs = 0; u.memoryMB = 0; u.storageMB = 0; u.apiCalls = 0; u.warnings = [];
        return true;
    }

    /** Count */
    count(): number { return this.usage.size; }

    // === Private ===
    private getOrCreate(id: string): ResourceUsage {
        if (!this.usage.has(id)) {
            this.usage.set(id, { id, cpuMs: 0, memoryMB: 0, storageMB: 0, apiCalls: 0, limits: { ...this.defaultLimits }, warnings: [] });
        }
        return this.usage.get(id)!;
    }

    private checkLimits(u: ResourceUsage, resource: string): { allowed: boolean; warning?: string } {
        const pct = this.getPercentage(u.id);
        if (!pct) return { allowed: true };
        const val = pct[resource] ?? 0;
        if (val >= 100) return { allowed: false, warning: `${resource} limit exceeded` };
        if (val >= 80) { const w = `${resource} at ${Math.round(val)}%`; u.warnings.push(w); return { allowed: true, warning: w }; }
        return { allowed: true };
    }
}
