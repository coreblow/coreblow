/**
 * src/gateway/ops.ts
 * Gateway operations — multi-gateway, remote access, hot reload, process management
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { getHomeDir, watchConfig, getConfig } from './config.js';

const log = createChildLogger('gateway:ops');

export interface GatewayInstance {
    id: string;
    name: string;
    host: string;
    port: number;
    status: 'running' | 'stopped' | 'unreachable';
    version: string;
    lastSeen: number;
}

/**
 * Multi-gateway registry — track and communicate with multiple gateways
 */
export class GatewayCluster {
    private instances: Map<string, GatewayInstance> = new Map();
    private storePath: string;

    constructor() {
        this.storePath = path.join(getHomeDir(), 'cluster.json');
        this.load();
    }

    /**
     * Register a gateway instance
     */
    register(instance: GatewayInstance) {
        this.instances.set(instance.id, instance);
        this.save();
        log.info({ id: instance.id, host: instance.host, port: instance.port }, 'Gateway registered');
    }

    /**
     * Remove a gateway from the cluster
     */
    unregister(id: string) {
        this.instances.delete(id);
        this.save();
    }

    /**
     * Check health of all instances
     */
    async healthCheck(): Promise<GatewayInstance[]> {
        const results: GatewayInstance[] = [];

        for (const inst of this.instances.values()) {
            try {
                const res = await fetch(
                    `http://${inst.host}:${inst.port}/api/health`,
                    { signal: AbortSignal.timeout(5000) }
                );
                if (res.ok) {
                    const data = await res.json() as any;
                    inst.status = 'running';
                    inst.version = data.version || inst.version;
                    inst.lastSeen = Date.now();
                } else {
                    inst.status = 'unreachable';
                }
            } catch {
                inst.status = 'unreachable';
            }
            results.push(inst);
        }

        this.save();
        return results;
    }

    /**
     * Forward a message to a specific gateway
     */
    async forward(gatewayId: string, message: any): Promise<any> {
        const inst = this.instances.get(gatewayId);
        if (!inst || inst.status !== 'running') {
            throw new Error(`Gateway ${gatewayId} not available`);
        }

        const res = await fetch(`http://${inst.host}:${inst.port}/api/forward`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
        });

        return res.json();
    }

    /**
     * List all registered instances
     */
    list(): GatewayInstance[] {
        return Array.from(this.instances.values());
    }

    private load() {
        try {
            if (fs.existsSync(this.storePath)) {
                const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
                for (const inst of data) this.instances.set(inst.id, inst);
            }
        } catch { /* no cluster file */ }
    }

    private save() {
        try {
            fs.writeFileSync(this.storePath, JSON.stringify(Array.from(this.instances.values()), null, 2));
        } catch { }
    }
}

/**
 * Remote access tunnel — expose local gateway via reverse proxy
 */
export class RemoteAccess {
    private tunnelProcess: any = null;
    private publicUrl: string = '';

    /**
     * Start a Cloudflare tunnel (cloudflared)
     */
    async startTunnel(port: number): Promise<string> {
        const { spawn } = await import('node:child_process');

        return new Promise((resolve, reject) => {
            this.tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            let output = '';
            this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
                output += data.toString();
                // cloudflared outputs the URL to stderr
                const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                if (match) {
                    this.publicUrl = match[0];
                    log.info({ url: this.publicUrl }, 'Tunnel established');
                    resolve(this.publicUrl);
                }
            });

            this.tunnelProcess.on('error', (err: Error) => {
                log.error({ err: err.message }, 'Tunnel failed');
                reject(err);
            });

            // Timeout
            setTimeout(() => {
                if (!this.publicUrl) {
                    reject(new Error('Tunnel timeout — is cloudflared installed?'));
                }
            }, 30000);
        });
    }

    /**
     * Stop the tunnel
     */
    stopTunnel() {
        if (this.tunnelProcess) {
            this.tunnelProcess.kill();
            this.tunnelProcess = null;
            this.publicUrl = '';
            log.info('Tunnel stopped');
        }
    }

    getPublicUrl(): string {
        return this.publicUrl;
    }
}

/**
 * Process supervisor — restart on crash, memory limits
 */
export class ProcessSupervisor {
    private memoryLimitMB: number;
    private checkInterval: NodeJS.Timeout | null = null;

    constructor(memoryLimitMB = 512) {
        this.memoryLimitMB = memoryLimitMB;
    }

    /**
     * Start monitoring
     */
    start() {
        this.checkInterval = setInterval(() => {
            const usage = process.memoryUsage();
            const heapMB = Math.round(usage.heapUsed / 1024 / 1024);

            if (heapMB > this.memoryLimitMB) {
                log.warn({ heapMB, limit: this.memoryLimitMB }, 'Memory limit exceeded, triggering GC');
                if (global.gc) {
                    global.gc();
                }
            }
        }, 60000); // Check every minute

        // Graceful shutdown handlers
        process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            log.error({ err: err.message }, 'Uncaught exception');
        });
        process.on('unhandledRejection', (reason: any) => {
            log.error({ reason: reason?.message || reason }, 'Unhandled rejection');
        });

        log.info({ memoryLimit: `${this.memoryLimitMB}MB` }, 'Process supervisor started');
    }

    private gracefulShutdown(signal: string) {
        log.info({ signal }, 'Graceful shutdown initiated');
        if (this.checkInterval) clearInterval(this.checkInterval);
        process.exit(0);
    }

    /**
     * Get process stats
     */
    getStats() {
        const mem = process.memoryUsage();
        return {
            pid: process.pid,
            uptime: process.uptime(),
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            cpuUsage: process.cpuUsage(),
        };
    }
}
