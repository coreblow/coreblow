/**
 * CoreBlow — Service Registry
 *
 * Central registry for all gateway services with
 * dependency injection, lifecycle management, and
 * health aggregation.
 *
 * Tier-2 services implement the {@link GatewayService} interface
 * for formal start/stop lifecycle and health reporting.
 */

// ---------------------------------------------------------------------------
// GatewayService interface — implemented by Tier-2 services that require
// lifecycle management (timers, sockets, persistent connections).
// ---------------------------------------------------------------------------

/** Health status reported by a gateway service. */
export interface ServiceHealth {
    status: 'healthy' | 'degraded' | 'down';
    detail?: string;
}

/**
 * Contract for services registered with the ServiceRegistry that need
 * managed start/stop lifecycle and health monitoring.
 */
export interface GatewayService {
    /** Unique service name used as the registry key. */
    readonly name: string;
    /** Start the service (open connections, start timers, etc.). */
    start(): Promise<void>;
    /** Stop the service gracefully (close connections, clear timers). */
    stop(): Promise<void>;
    /** Return current health status. */
    health(): ServiceHealth;
}

// ---------------------------------------------------------------------------
// ServiceEntry
// ---------------------------------------------------------------------------

/** Internal registry entry. */
export interface ServiceEntry {
    name: string;
    instance: unknown;
    status: 'registered' | 'started' | 'stopped' | 'error';
    dependencies: string[];
    startedAt?: number;
    stoppedAt?: number;
    metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Type guard
// ---------------------------------------------------------------------------

/** Check whether an instance implements {@link GatewayService}. */
function isGatewayService(instance: unknown): instance is GatewayService {
    if (typeof instance !== 'object' || instance === null) return false;
    const obj = instance as Record<string, unknown>;
    return (
        typeof obj.name === 'string' &&
        typeof obj.start === 'function' &&
        typeof obj.stop === 'function' &&
        typeof obj.health === 'function'
    );
}

// ---------------------------------------------------------------------------
// ServiceRegistry
// ---------------------------------------------------------------------------

/**
 * CoreBlow Service Registry
 *
 * Manages registration, dependency-ordered startup, reverse-order shutdown,
 * and health aggregation for gateway-level services.
 */
export class ServiceRegistry {
    private services = new Map<string, ServiceEntry>();

    /**
     * Register a service.
     *
     * @param name         Unique service name (used as lookup key).
     * @param instance     Service instance. If it implements {@link GatewayService},
     *                     lifecycle methods (start/stop/health) will be called
     *                     automatically by {@link startAll} / {@link stopAll}.
     * @param dependencies Names of services that must be started before this one.
     */
    register(name: string, instance: unknown, dependencies: string[] = []): void {
        this.services.set(name, { name, instance, status: 'registered', dependencies });
    }

    /**
     * Resolve a service by name with an unchecked cast.
     */
    resolve<T = unknown>(name: string): T | null {
        return (this.services.get(name)?.instance as T) ?? null;
    }

    /**
     * Resolve a service by name, asserting it implements {@link GatewayService}.
     * Returns `null` if not found or if the instance is not a GatewayService.
     */
    resolveTyped<T extends GatewayService>(name: string): T | null {
        const entry = this.services.get(name);
        if (!entry || !isGatewayService(entry.instance)) return null;
        return entry.instance as T;
    }

    /**
     * Start a single service. If the instance implements {@link GatewayService},
     * its async `start()` method is called.
     */
    async start(name: string): Promise<boolean> {
        const svc = this.services.get(name);
        if (!svc) return false;

        // Check dependencies are started
        for (const dep of svc.dependencies) {
            const depSvc = this.services.get(dep);
            if (!depSvc || depSvc.status !== 'started') return false;
        }

        try {
            if (isGatewayService(svc.instance)) {
                await svc.instance.start();
            }
            svc.status = 'started';
            svc.startedAt = Date.now();
            svc.stoppedAt = undefined;
            return true;
        } catch {
            svc.status = 'error';
            return false;
        }
    }

    /**
     * Start all services in topological (dependency) order.
     */
    async startAll(): Promise<{ started: string[]; failed: string[] }> {
        const started: string[] = [];
        const failed: string[] = [];
        const visited = new Set<string>();

        const startRecursive = async (name: string): Promise<boolean> => {
            if (visited.has(name)) return this.services.get(name)?.status === 'started';
            visited.add(name);

            const svc = this.services.get(name);
            if (!svc) { failed.push(name); return false; }

            for (const dep of svc.dependencies) {
                if (!(await startRecursive(dep))) { failed.push(name); return false; }
            }

            if (await this.start(name)) { started.push(name); return true; }
            failed.push(name);
            return false;
        };

        for (const name of Array.from(this.services.keys())) {
            await startRecursive(name);
        }
        return { started, failed };
    }

    /**
     * Stop a single service. If the instance implements {@link GatewayService},
     * its async `stop()` method is called.
     */
    async stop(name: string): Promise<boolean> {
        const svc = this.services.get(name);
        if (!svc) return false;

        try {
            if (isGatewayService(svc.instance)) {
                await svc.instance.stop();
            }
            svc.status = 'stopped';
            svc.stoppedAt = Date.now();
            return true;
        } catch {
            svc.status = 'error';
            return false;
        }
    }

    /**
     * Stop all services in **reverse dependency order**.
     *
     * Services that depend on others are stopped first, then their
     * dependencies. This ensures no service is stopped while a
     * dependent is still running.
     */
    async stopAll(): Promise<{ stopped: string[]; failed: string[] }> {
        const stopped: string[] = [];
        const failed: string[] = [];

        // Build reverse dependency order: services with no dependents first reversed
        const order = this.topologicalOrder();
        const reversed = [...order].reverse();

        for (const name of reversed) {
            if (await this.stop(name)) {
                stopped.push(name);
            } else {
                failed.push(name);
            }
        }
        return { stopped, failed };
    }

    /**
     * Get health summary for all registered services.
     * If a service implements {@link GatewayService}, its `health()` method
     * is called for detailed status. Otherwise, registry status is used.
     */
    getHealth(): Array<{ name: string; status: string; uptime?: number; detail?: string }> {
        return Array.from(this.services.values()).map((s) => {
            const base = {
                name: s.name,
                status: s.status,
                uptime: s.startedAt ? Date.now() - s.startedAt : undefined,
            };

            // Enrich with GatewayService health if available
            if (s.status === 'started' && isGatewayService(s.instance)) {
                const h = s.instance.health();
                return { ...base, status: h.status, detail: h.detail };
            }
            return base;
        });
    }

    /**
     * List services with metadata.
     */
    list(): Array<{ name: string; status: string; deps: string[] }> {
        return Array.from(this.services.values()).map((s) => ({
            name: s.name, status: s.status, deps: s.dependencies,
        }));
    }

    /** Count registered services. */
    count(): number { return this.services.size; }

    /**
     * Topological sort of services (dependencies first).
     * Used internally for startAll/stopAll ordering.
     */
    private topologicalOrder(): string[] {
        const result: string[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (name: string) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            visiting.add(name);
            const svc = this.services.get(name);
            if (svc) {
                for (const dep of svc.dependencies) {
                    visit(dep);
                }
            }
            visiting.delete(name);
            visited.add(name);
            result.push(name);
        };

        for (const name of this.services.keys()) {
            visit(name);
        }
        return result;
    }
}
