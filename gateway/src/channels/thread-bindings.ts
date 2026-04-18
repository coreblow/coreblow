/**
 * channels/thread-bindings.ts
 * Thread binding lifecycle and ownership management.
 * Ported from CoreBlow src/plugin-sdk/thread-bindings-runtime.ts + thread-bindings-policy.ts.
 */

export type BindingTargetKind = 'agent' | 'session' | 'user';

export interface ThreadBinding {
    threadId: string;
    channelId: string;
    targetKind: BindingTargetKind;
    targetId: string;
    createdAt: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}

export interface ThreadBindingPolicy {
    defaultTargetKind: BindingTargetKind;
    autoBindOnCreate: boolean;
    bindingTtlMs?: number;
    maxBindingsPerChannel: number;
}

const DEFAULT_POLICY: ThreadBindingPolicy = {
    defaultTargetKind: 'session',
    autoBindOnCreate: true,
    bindingTtlMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxBindingsPerChannel: 100,
};

/**
 * In-memory thread binding registry.
 */
export class ThreadBindingRegistry {
    private bindings = new Map<string, ThreadBinding>();
    private policy: ThreadBindingPolicy;

    constructor(policy?: Partial<ThreadBindingPolicy>) {
        this.policy = { ...DEFAULT_POLICY, ...policy };
    }

    /**
     * Bind a thread to a target.
     */
    bind(params: { threadId: string; channelId: string; targetKind?: BindingTargetKind; targetId: string; metadata?: Record<string, unknown> }): ThreadBinding {
        const key = this.buildKey(params.channelId, params.threadId);
        this.pruneExpired();

        // Enforce max bindings per channel
        const channelBindings = [...this.bindings.values()].filter((b) => b.channelId === params.channelId);
        if (channelBindings.length >= this.policy.maxBindingsPerChannel) {
            // Remove oldest
            const oldest = channelBindings.sort((a, b) => a.createdAt - b.createdAt)[0];
            if (oldest) this.bindings.delete(this.buildKey(oldest.channelId, oldest.threadId));
        }

        const binding: ThreadBinding = {
            threadId: params.threadId,
            channelId: params.channelId,
            targetKind: params.targetKind ?? this.policy.defaultTargetKind,
            targetId: params.targetId,
            createdAt: Date.now(),
            expiresAt: this.policy.bindingTtlMs ? Date.now() + this.policy.bindingTtlMs : undefined,
            metadata: params.metadata,
        };

        this.bindings.set(key, binding);
        return binding;
    }

    /**
     * Resolve the binding for a thread.
     */
    resolve(channelId: string, threadId: string): ThreadBinding | null {
        this.pruneExpired();
        return this.bindings.get(this.buildKey(channelId, threadId)) ?? null;
    }

    /**
     * Unbind a thread.
     */
    unbind(channelId: string, threadId: string): boolean {
        return this.bindings.delete(this.buildKey(channelId, threadId));
    }

    /**
     * List all bindings for a channel.
     */
    listForChannel(channelId: string): ThreadBinding[] {
        this.pruneExpired();
        return [...this.bindings.values()].filter((b) => b.channelId === channelId);
    }

    /**
     * List all bindings for a target.
     */
    listForTarget(targetId: string): ThreadBinding[] {
        this.pruneExpired();
        return [...this.bindings.values()].filter((b) => b.targetId === targetId);
    }

    /**
     * Get total binding count.
     */
    size(): number { this.pruneExpired(); return this.bindings.size; }

    /**
     * Clear all bindings.
     */
    clear(): void { this.bindings.clear(); }

    private buildKey(channelId: string, threadId: string): string { return `${channelId}::${threadId}`; }

    private pruneExpired(): void {
        const now = Date.now();
        for (const [key, binding] of this.bindings) {
            if (binding.expiresAt && binding.expiresAt < now) this.bindings.delete(key);
        }
    }
}

/**
 * Resolve thread binding lifecycle policy from config.
 */
export function resolveThreadBindingLifecycle(cfg?: Record<string, unknown>): ThreadBindingPolicy {
    const threads = (cfg as Record<string, unknown> | undefined)?.threads as Record<string, unknown> | undefined;
    if (!threads) return { ...DEFAULT_POLICY };

    return {
        defaultTargetKind: resolveTargetKind(threads.defaultTargetKind) ?? DEFAULT_POLICY.defaultTargetKind,
        autoBindOnCreate: typeof threads.autoBindOnCreate === 'boolean' ? threads.autoBindOnCreate : DEFAULT_POLICY.autoBindOnCreate,
        bindingTtlMs: typeof threads.bindingTtlMs === 'number' ? threads.bindingTtlMs : DEFAULT_POLICY.bindingTtlMs,
        maxBindingsPerChannel: typeof threads.maxBindingsPerChannel === 'number' ? threads.maxBindingsPerChannel : DEFAULT_POLICY.maxBindingsPerChannel,
    };
}

function resolveTargetKind(raw: unknown): BindingTargetKind | null {
    if (raw === 'agent' || raw === 'session' || raw === 'user') return raw;
    return null;
}
