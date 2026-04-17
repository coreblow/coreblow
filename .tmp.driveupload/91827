/**
 * utils/log-context.ts
 * Request-scoped logging context using AsyncLocalStorage.
 * Provides automatic correlation ID propagation across async boundaries.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';

// ─── Context Types ────────────────────────────────────────────────

export interface LogContext {
    requestId: string;
    sessionId?: string;
    channel?: string;
    turnId?: string;
    agentId?: string;
    userId?: string;
    startTime: number;
    [key: string]: unknown;
}

// ─── Storage ──────────────────────────────────────────────────────

const asyncStorage = new AsyncLocalStorage<LogContext>();

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Run a function with a new log context.
 * All async operations within the callback inherit this context.
 */
export function runWithLogContext<T>(context: Partial<LogContext>, fn: () => T): T {
    const fullContext: LogContext = {
        requestId: context.requestId ?? generateRequestId(),
        startTime: context.startTime ?? Date.now(),
        ...context,
    };
    return asyncStorage.run(fullContext, fn);
}

/**
 * Get the current log context (if any).
 */
export function getLogContext(): LogContext | undefined {
    return asyncStorage.getStore();
}

/**
 * Get the current request ID (or generate one).
 */
export function getRequestId(): string {
    return asyncStorage.getStore()?.requestId ?? generateRequestId();
}

/**
 * Extend the current log context with additional fields.
 */
export function extendLogContext(fields: Partial<LogContext>): void {
    const current = asyncStorage.getStore();
    if (current) {
        Object.assign(current, fields);
    }
}

/**
 * Get context bindings for logger child creation.
 * Returns only non-undefined fields.
 */
export function getContextBindings(): Record<string, string | number> {
    const ctx = asyncStorage.getStore();
    if (!ctx) return {};

    const bindings: Record<string, string | number> = {};
    if (ctx.requestId) bindings.requestId = ctx.requestId;
    if (ctx.sessionId) bindings.sessionId = ctx.sessionId;
    if (ctx.channel) bindings.channel = ctx.channel;
    if (ctx.turnId) bindings.turnId = ctx.turnId;
    if (ctx.agentId) bindings.agentId = ctx.agentId;
    if (ctx.userId) bindings.userId = ctx.userId;
    return bindings;
}

/**
 * Calculate elapsed time from context start.
 */
export function getElapsedMs(): number {
    const ctx = asyncStorage.getStore();
    return ctx ? Date.now() - ctx.startTime : 0;
}
