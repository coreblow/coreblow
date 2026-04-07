/**
 * CoreBlow — Main Server
 *
 * The main entry point that ties all gateway subsystems
 * together: config, providers, agents, channels,
 * security, and observability.
 */

import { AppBootstrapper } from './app-bootstrapper.js';
import { GracefulShutdown } from './graceful-shutdown.js';
import { ServiceRegistry } from './service-registry.js';
import type { MemoryOrchestrator } from '../memory/memory-orchestrator.js';
import type { PersistentVectorStore } from '../memory/vector-store-persistence.js';

/** Server options */
export interface ServerOptions {
    port: number;
    host: string;
    env: string;
}

/** Server status */
export interface ServerStatus {
    running: boolean;
    uptime: number;
    port: number;
    env: string;
    services: number;
    startedAt?: number;
}

/**
 * CoreBlow Server
 */
export class CoreBlowServer {
    private options: ServerOptions;
    private bootstrapper: AppBootstrapper;
    private shutdown: GracefulShutdown;
    private registry: ServiceRegistry;
    private running = false;
    private startedAt?: number;
    private memoryOrchestrator?: MemoryOrchestrator;
    private persistentVectorStore?: PersistentVectorStore;

    constructor(options?: Partial<ServerOptions>) {
        this.options = {
            port: options?.port ?? 3000,
            host: options?.host ?? '0.0.0.0',
            env: options?.env ?? 'development',
        };
        this.bootstrapper = new AppBootstrapper();
        this.shutdown = new GracefulShutdown();
        this.registry = new ServiceRegistry();
    }

    /**
     * Start the server.
     */
    async start(): Promise<{ success: boolean; port: number; bootResult: unknown }> {
        // Register core services
        this.registry.register('config', {}, []);
        this.registry.register('security', {}, ['config']);
        this.registry.register('providers', {}, ['config']);
        this.registry.register('agents', {}, ['providers']);
        this.registry.register('channels', {}, ['agents']);
        this.registry.register('gateway', {}, ['channels', 'security']);

        // Register boot phases
        this.bootstrapper.register({
            name: 'config', order: 1, required: true,
            init: async () => { this.registry.start('config'); },
        });
        this.bootstrapper.register({
            name: 'security', order: 2, required: true,
            init: async () => { this.registry.start('security'); },
        });
        this.bootstrapper.register({
            name: 'providers', order: 3, required: true,
            init: async () => { this.registry.start('providers'); },
        });
        this.bootstrapper.register({
            name: 'agents', order: 4, required: false,
            init: async () => { this.registry.start('agents'); },
        });
        this.bootstrapper.register({
            name: 'channels', order: 5, required: false,
            init: async () => { this.registry.start('channels'); },
        });
        this.bootstrapper.register({
            name: 'gateway', order: 6, required: true,
            init: async () => { this.registry.start('gateway'); },
        });

        // Register shutdown hooks (order 0 = memory first — flush data before stopping services)
        this.shutdown.register({
            name: 'memory', order: 0,
            handler: async () => {
                if (this.memoryOrchestrator) await this.memoryOrchestrator.flush();
                if (this.persistentVectorStore) await this.persistentVectorStore.saveNow();
            },
        });
        this.shutdown.register({ name: 'channels', order: 1, handler: async () => { this.registry.stop('channels'); } });
        this.shutdown.register({ name: 'agents', order: 2, handler: async () => { this.registry.stop('agents'); } });
        this.shutdown.register({ name: 'providers', order: 3, handler: async () => { this.registry.stop('providers'); } });
        this.shutdown.register({ name: 'gateway', order: 4, handler: async () => { this.registry.stop('gateway'); } });

        const bootResult = await this.bootstrapper.boot();
        this.running = bootResult.success;
        if (this.running) this.startedAt = Date.now();

        return { success: bootResult.success, port: this.options.port, bootResult };
    }

    /**
     * Stop the server.
     */
    async stop(): Promise<void> {
        await this.shutdown.shutdown();
        this.running = false;
    }

    /**
     * Get server status.
     */
    getStatus(): ServerStatus {
        return {
            running: this.running,
            uptime: this.startedAt ? Date.now() - this.startedAt : 0,
            port: this.options.port,
            env: this.options.env,
            services: this.registry.count(),
            startedAt: this.startedAt,
        };
    }

    /**
     * Get service registry.
     */
    getRegistry(): ServiceRegistry { return this.registry; }

    /**
     * Get bootstrapper.
     */
    getBootstrapper(): AppBootstrapper { return this.bootstrapper; }

    /**
     * Register memory subsystem for graceful shutdown.
     * Called from memory-bootstrap after MemoryOrchestrator is created.
     */
    registerMemory(orchestrator: MemoryOrchestrator, vectorStore?: PersistentVectorStore): void {
        this.memoryOrchestrator = orchestrator;
        this.persistentVectorStore = vectorStore;
    }
}

/** Alias for CoreBlowServer for backward compatibility */
export class GatewayServer {
    public port: number;
    private host: string;
    private routes: Array<{ method: string; path: string; handler: Function }> = [];
    private middlewares: Function[] = [];
    private httpServer: import('node:http').Server | null = null;
    private startedAt?: number;

    constructor(opts?: { port?: number; host?: string }) {
        this.port = opts?.port ?? 3000;
        this.host = opts?.host ?? '0.0.0.0';
    }

    route(method: string, path: string, handler: Function): this {
        this.routes.push({ method, path, handler });
        return this;
    }

    use(middleware: Function): this {
        this.middlewares.push(middleware);
        return this;
    }

    getInfo() { return { port: this.port, host: this.host, uptime: this.startedAt ? Date.now() - this.startedAt : 0 }; }

    async start(): Promise<void> {
        const http = await import('node:http');
        this.httpServer = http.createServer();
        await new Promise<void>((resolve) => this.httpServer!.listen(this.port, this.host, resolve));
        this.startedAt = Date.now();
    }

    async stop(): Promise<void> {
        if (this.httpServer) await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
    }
}


export interface GatewayServer { port: number; start(): Promise<void>; stop(): Promise<void>; }
