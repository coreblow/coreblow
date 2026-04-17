/**
 * CoreBlow Thread Binding
 *
 * Manages thread-to-agent and thread-to-config bindings.
 * Supports per-thread model/prompt overrides, TTL, and inheritance.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:threads');

export interface ThreadBinding {
    threadId: string;
    channelId: string;
    agentId?: string;
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    metadata?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
    expiresAt?: number;
}

export interface ThreadBindingOptions {
    ttlMs?: number;
    inherit?: boolean;
}

const bindings = new Map<string, ThreadBinding>();

export function bindThread(threadId: string, channelId: string, overrides?: Partial<ThreadBinding>, opts?: ThreadBindingOptions): ThreadBinding {
    const now = Date.now();
    const existing = bindings.get(threadId);
    const binding: ThreadBinding = {
        ...(opts?.inherit && existing ? existing : {}),
        threadId,
        channelId,
        ...overrides,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        expiresAt: opts?.ttlMs ? now + opts.ttlMs : undefined,
    };
    bindings.set(threadId, binding);
    log.debug({ threadId, channelId }, 'Thread bound');
    return binding;
}

export function getBinding(threadId: string): ThreadBinding | undefined {
    const binding = bindings.get(threadId);
    if (!binding) return undefined;
    if (binding.expiresAt && Date.now() > binding.expiresAt) {
        bindings.delete(threadId);
        return undefined;
    }
    return binding;
}

export function unbindThread(threadId: string): boolean {
    return bindings.delete(threadId);
}

export function listBindings(channelId?: string): ThreadBinding[] {
    const now = Date.now();
    const all = Array.from(bindings.values()).filter((b) => {
        if (b.expiresAt && now > b.expiresAt) { bindings.delete(b.threadId); return false; }
        return true;
    });
    return channelId ? all.filter((b) => b.channelId === channelId) : all;
}

export function clearBindings(channelId?: string): number {
    if (!channelId) { const c = bindings.size; bindings.clear(); return c; }
    let cleared = 0;
    for (const [id, b] of bindings) {
        if (b.channelId === channelId) { bindings.delete(id); cleared++; }
    }
    return cleared;
}

export function resolveThreadModel(threadId: string, fallbackModel: string): string {
    return getBinding(threadId)?.model ?? fallbackModel;
}

export function resolveThreadPrompt(threadId: string, fallbackPrompt: string): string {
    return getBinding(threadId)?.systemPrompt ?? fallbackPrompt;
}

export function cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, b] of bindings) {
        if (b.expiresAt && now > b.expiresAt) { bindings.delete(id); cleaned++; }
    }
    return cleaned;
}

export function getBindingStats(): { total: number; byChannel: Record<string, number>; expired: number } {
    const now = Date.now();
    const byChannel: Record<string, number> = {};
    let expired = 0;
    for (const b of bindings.values()) {
        if (b.expiresAt && now > b.expiresAt) { expired++; continue; }
        byChannel[b.channelId] = (byChannel[b.channelId] ?? 0) + 1;
    }
    return { total: bindings.size, byChannel, expired };
}
