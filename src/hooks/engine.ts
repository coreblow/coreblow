/**
 * CoreBlow Hooks Engine
 *
 * Event-driven hook execution system. Hooks listen for specific events
 * (e.g., "message:inbound", "session:start", "command:new") and execute
 * their handlers when fired. Supports sync/async execution, priority
 * ordering, fire-and-forget mode, and bundled hook discovery.
 *
 * Expanded with: unregister, getHookById, snapshot, wildcard matching.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Hook metadata describing when and how a hook runs */
export interface HookMetadata {
    /** Events this hook handles */
    events: string[];
    /** Execution priority (lower = earlier). Default: 100 */
    priority?: number;
    /** Run asynchronously without blocking the event pipeline */
    fireAndForget?: boolean;
    /** Required OS (e.g., ["darwin", "linux"]) */
    os?: string[];
    /** Required environment variables */
    requiresEnv?: string[];
    /** Human-friendly emoji for logging */
    emoji?: string;
    /** Hook homepage/docs URL */
    homepage?: string;
    /** Whether hook is always enabled */
    always?: boolean;
}

/** Hook handler function signature */
export type HookHandler = (ctx: HookContext) => Promise<void> | void;

/** Context passed to each hook handler */
export interface HookContext {
    /** Event name that triggered the hook */
    event: string;
    /** Event payload */
    payload: Record<string, unknown>;
    /** Timestamp when the event was emitted */
    timestamp: number;
    /** Shared mutable bag for hooks to communicate during a pipeline */
    shared: Record<string, unknown>;
}

/** Registered hook entry */
export interface HookEntry {
    id: string;
    name: string;
    source: 'bundled' | 'installed' | 'workspace' | 'plugin';
    metadata: HookMetadata;
    handler: HookHandler;
    enabled: boolean;
}

/** Hook execution result */
export interface HookResult {
    hookId: string;
    event: string;
    durationMs: number;
    error?: string;
}

/** Lightweight snapshot of engine state (serializable, no handler refs) */
export interface HookSnapshot {
    hooks: Array<{
        id: string;
        name: string;
        source: string;
        events: string[];
        enabled: boolean;
        priority: number;
    }>;
    totalHistory: number;
    version: number;
}

/**
 * CoreBlow Hooks Engine
 */
export class HooksEngine {
    private hooks: HookEntry[] = [];
    private history: HookResult[] = [];
    private maxHistory = 200;
    private snapshotVersion = 0;

    /**
     * Register a hook.
     */
    register(entry: HookEntry): void {
        // Validate
        if (!entry.id || !entry.metadata.events.length) {
            throw new Error(`Hook must have an id and at least one event`);
        }

        // Check OS eligibility
        if (entry.metadata.os && entry.metadata.os.length > 0) {
            if (!entry.metadata.os.includes(process.platform)) {
                return; // Skip — unsupported OS
            }
        }

        // Check env requirements
        if (entry.metadata.requiresEnv) {
            for (const envVar of entry.metadata.requiresEnv) {
                if (!process.env[envVar]) {
                    return; // Skip — missing env
                }
            }
        }

        // Prevent duplicates
        const existingIdx = this.hooks.findIndex(h => h.id === entry.id);
        if (existingIdx !== -1) {
            this.hooks[existingIdx] = entry;
        } else {
            this.hooks.push(entry);
        }

        // Sort by priority
        this.hooks.sort(
            (a, b) => (a.metadata.priority ?? 100) - (b.metadata.priority ?? 100),
        );

        this.snapshotVersion++;
    }

    /**
     * Unregister a hook by ID.
     */
    unregister(hookId: string): boolean {
        const idx = this.hooks.findIndex(h => h.id === hookId);
        if (idx === -1) return false;
        this.hooks.splice(idx, 1);
        this.snapshotVersion++;
        return true;
    }

    /**
     * Get a hook by ID.
     */
    getHookById(hookId: string): HookEntry | undefined {
        return this.hooks.find(h => h.id === hookId);
    }

    /**
     * Emit an event to all matching hooks.
     * Supports exact event names and wildcard (`*`) matching.
     */
    async emit(event: string, payload: Record<string, unknown> = {}): Promise<HookResult[]> {
        const matching = this.hooks.filter(
            (h) => h.enabled && this.eventMatches(h.metadata.events, event),
        );

        const ctx: HookContext = {
            event,
            payload,
            timestamp: Date.now(),
            shared: {},
        };

        const results: HookResult[] = [];

        for (const hook of matching) {
            if (hook.metadata.fireAndForget) {
                // Non-blocking execution
                void this.executeHook(hook, ctx).then((r) => {
                    this.recordResult(r);
                });
                results.push({ hookId: hook.id, event, durationMs: 0 });
            } else {
                const result = await this.executeHook(hook, ctx);
                this.recordResult(result);
                results.push(result);
            }
        }

        return results;
    }

    /**
     * Enable/disable a hook.
     */
    setEnabled(hookId: string, enabled: boolean): boolean {
        const hook = this.hooks.find((h) => h.id === hookId);
        if (!hook) return false;
        hook.enabled = enabled;
        this.snapshotVersion++;
        return true;
    }

    /**
     * List all registered hooks.
     */
    list(): HookEntry[] {
        return [...this.hooks];
    }

    /**
     * Get recent execution history.
     */
    getHistory(limit: number = 50): HookResult[] {
        return this.history.slice(-limit);
    }

    /**
     * Create a serializable snapshot of the current engine state.
     */
    snapshot(): HookSnapshot {
        return {
            hooks: this.hooks.map(h => ({
                id: h.id,
                name: h.name,
                source: h.source,
                events: [...h.metadata.events],
                enabled: h.enabled,
                priority: h.metadata.priority ?? 100,
            })),
            totalHistory: this.history.length,
            version: this.snapshotVersion,
        };
    }

    /**
     * Discover and register bundled hooks from a directory.
     * Each hook is a subdirectory containing handler.ts/js.
     */
    async discoverBundled(baseDir: string): Promise<number> {
        let count = 0;

        if (!fs.existsSync(baseDir)) return 0;

        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const hookDir = path.join(baseDir, entry.name);
            const handlerPath = ['handler.ts', 'handler.js', 'handler.mjs']
                .map((f) => path.join(hookDir, f))
                .find((f) => fs.existsSync(f));

            if (!handlerPath) continue;

            try {
                const mod = await import(handlerPath);
                const handler = mod.default ?? mod.handler;
                const metadata: HookMetadata = mod.metadata ?? {
                    events: mod.events ?? ['*'],
                };

                this.register({
                    id: `bundled:${entry.name}`,
                    name: entry.name,
                    source: 'bundled',
                    metadata,
                    handler,
                    enabled: true,
                });

                count++;
            } catch {
                // Failed to load hook — skip
            }
        }

        return count;
    }

    /**
     * Remove all hooks (for testing).
     */
    clear(): void {
        this.hooks = [];
        this.history = [];
        this.snapshotVersion = 0;
    }

    // === Private ===

    private eventMatches(hookEvents: string[], firedEvent: string): boolean {
        for (const pattern of hookEvents) {
            if (pattern === '*') return true;
            if (pattern === firedEvent) return true;
            // Wildcard: "message:*" matches "message:received"
            if (pattern.endsWith(':*')) {
                const prefix = pattern.slice(0, -2);
                if (firedEvent.startsWith(prefix + ':')) return true;
            }
        }
        return false;
    }

    private async executeHook(hook: HookEntry, ctx: HookContext): Promise<HookResult> {
        const start = Date.now();
        try {
            await hook.handler(ctx);
            return { hookId: hook.id, event: ctx.event, durationMs: Date.now() - start };
        } catch (err) {
            return {
                hookId: hook.id,
                event: ctx.event,
                durationMs: Date.now() - start,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    private recordResult(result: HookResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }
}
