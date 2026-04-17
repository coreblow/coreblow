/**
 * plugins/services.ts
 *
 * Plugin service lifecycle management — start, stop, health check.
 * Following CoreBlow's services.ts (78 LOC) pattern, expanded with
 * CoreBlow's OOP lifecycle patterns.
 */

import { createChildLogger } from '../utils/logger.js';
import type { PluginLogger, PluginServiceRegistration } from './types.js';

const log = createChildLogger('plugin:services');

// ─── Types ───────────────────────────────────────────────────────

export interface ServiceHealth {
    serviceId: string;
    pluginId: string;
    healthy: boolean;
    error?: string;
    lastChecked: number;
}

export interface ServiceManagerStats {
    total: number;
    running: number;
    stopped: number;
    errored: number;
}

// ─── PluginServiceManager ────────────────────────────────────────

/**
 * CoreBlow Plugin Service Manager
 *
 * Manages plugin-owned background services with start/stop lifecycle,
 * health monitoring, and graceful shutdown.
 */
export class PluginServiceManager {
    private logger: PluginLogger;
    private services: PluginServiceRegistration[] = [];
    private runningServices = new Set<string>();
    private healthCache = new Map<string, ServiceHealth>();

    constructor(logger?: PluginLogger) {
        this.logger = logger ?? {
            info: (msg) => log.info(msg),
            warn: (msg) => log.warn(msg),
            error: (msg) => log.error(msg),
            debug: (msg) => log.debug(msg),
        };
    }

    /**
     * Register a service.
     */
    register(registration: PluginServiceRegistration): void {
        this.services.push(registration);
    }

    /**
     * Register multiple services.
     */
    registerAll(registrations: PluginServiceRegistration[]): void {
        for (const reg of registrations) {
            this.register(reg);
        }
    }

    /**
     * Start all registered services.
     */
    async startAll(): Promise<{ started: number; failed: number }> {
        let started = 0;
        let failed = 0;

        for (const { service, pluginId } of this.services) {
            const key = `${pluginId}:${service.id}`;
            if (this.runningServices.has(key)) continue;

            try {
                if (service.start) {
                    await service.start();
                }
                this.runningServices.add(key);
                started++;
                this.logger.info(`[services] Started ${key}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`[services] Failed to start ${key}: ${msg}`);
                this.healthCache.set(key, {
                    serviceId: service.id,
                    pluginId,
                    healthy: false,
                    error: msg,
                    lastChecked: Date.now(),
                });
                failed++;
            }
        }

        return { started, failed };
    }

    /**
     * Stop all running services.
     */
    async stopAll(): Promise<{ stopped: number; failed: number }> {
        let stopped = 0;
        let failed = 0;

        for (const { service, pluginId } of this.services) {
            const key = `${pluginId}:${service.id}`;
            if (!this.runningServices.has(key)) continue;

            try {
                if (service.stop) {
                    await service.stop();
                }
                this.runningServices.delete(key);
                stopped++;
                this.logger.info(`[services] Stopped ${key}`);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`[services] Failed to stop ${key}: ${msg}`);
                failed++;
            }
        }

        return { stopped, failed };
    }

    /**
     * Health check all services.
     */
    async healthCheckAll(): Promise<ServiceHealth[]> {
        const results: ServiceHealth[] = [];

        for (const { service, pluginId } of this.services) {
            const key = `${pluginId}:${service.id}`;
            try {
                if (service.healthCheck) {
                    const check = await service.healthCheck();
                    const health: ServiceHealth = {
                        serviceId: service.id,
                        pluginId,
                        healthy: check.healthy,
                        error: check.error,
                        lastChecked: Date.now(),
                    };
                    this.healthCache.set(key, health);
                    results.push(health);
                } else {
                    const health: ServiceHealth = {
                        serviceId: service.id,
                        pluginId,
                        healthy: this.runningServices.has(key),
                        lastChecked: Date.now(),
                    };
                    this.healthCache.set(key, health);
                    results.push(health);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                const health: ServiceHealth = {
                    serviceId: service.id,
                    pluginId,
                    healthy: false,
                    error: msg,
                    lastChecked: Date.now(),
                };
                this.healthCache.set(key, health);
                results.push(health);
            }
        }

        return results;
    }

    /**
     * Get service health from cache.
     */
    getHealth(pluginId: string, serviceId: string): ServiceHealth | undefined {
        return this.healthCache.get(`${pluginId}:${serviceId}`);
    }

    /**
     * Get stats.
     */
    getStats(): ServiceManagerStats {
        return {
            total: this.services.length,
            running: this.runningServices.size,
            stopped: this.services.length - this.runningServices.size,
            errored: [...this.healthCache.values()].filter((h) => !h.healthy).length,
        };
    }

    /**
     * Check if a specific service is running.
     */
    isRunning(pluginId: string, serviceId: string): boolean {
        return this.runningServices.has(`${pluginId}:${serviceId}`);
    }

    /**
     * Get all registered services.
     */
    getServices(): PluginServiceRegistration[] {
        return [...this.services];
    }
}
