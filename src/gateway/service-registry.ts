/**
 * CoreBlow — Service Registry
 *
 * Central registry for all gateway services with
 * dependency injection, lifecycle management, and
 * health aggregation.
 */

/** Service entry */
export interface ServiceEntry {
    name: string;
    instance: unknown;
    status: 'registered' | 'started' | 'stopped' | 'error';
    dependencies: string[];
    startedAt?: number;
    metadata?: Record<string, unknown>;
}

/**
 * CoreBlow Service Registry
 */
export class ServiceRegistry {
    private services = new Map<string, ServiceEntry>();

    /**
     * Register a service.
     */
    register(name: string, instance: unknown, dependencies: string[] = []): void {
        this.services.set(name, { name, instance, status: 'registered', dependencies });
    }

    /**
     * Resolve a service.
     */
    resolve<T = unknown>(name: string): T | null {
        return (this.services.get(name)?.instance as T) ?? null;
    }

    /**
     * Start a service.
     */
    start(name: string): boolean {
        const svc = this.services.get(name);
        if (!svc) return false;

        // Check dependencies
        for (const dep of svc.dependencies) {
            const depSvc = this.services.get(dep);
            if (!depSvc || depSvc.status !== 'started') return false;
        }

        svc.status = 'started';
        svc.startedAt = Date.now();
        return true;
    }

    /**
     * Start all in dependency order.
     */
    startAll(): { started: string[]; failed: string[] } {
        const started: string[] = [];
        const failed: string[] = [];
        const visited = new Set<string>();

        const startRecursive = (name: string): boolean => {
            if (visited.has(name)) return this.services.get(name)?.status === 'started';
            visited.add(name);

            const svc = this.services.get(name);
            if (!svc) { failed.push(name); return false; }

            for (const dep of svc.dependencies) {
                if (!startRecursive(dep)) { failed.push(name); return false; }
            }

            if (this.start(name)) { started.push(name); return true; }
            failed.push(name);
            return false;
        };

        for (const name of Array.from(this.services.keys())) startRecursive(name);
        return { started, failed };
    }

    /**
     * Stop a service.
     */
    stop(name: string): boolean {
        const svc = this.services.get(name);
        if (!svc) return false;
        svc.status = 'stopped';
        return true;
    }

    /**
     * Get health summary.
     */
    getHealth(): Array<{ name: string; status: string; uptime?: number }> {
        return Array.from(this.services.values()).map((s) => ({
            name: s.name, status: s.status,
            uptime: s.startedAt ? Date.now() - s.startedAt : undefined,
        }));
    }

    /**
     * List services.
     */
    list(): Array<{ name: string; status: string; deps: string[] }> {
        return Array.from(this.services.values()).map((s) => ({
            name: s.name, status: s.status, deps: s.dependencies,
        }));
    }

    /** Count */
    count(): number { return this.services.size; }
}
