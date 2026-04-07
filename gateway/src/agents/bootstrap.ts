/**
 * CoreBlow Bootstrap System
 *
 * Manages agent bootstrap: budget allocation, file preloading, caching,
 * and hook registration. Consolidates bootstrap-budget, bootstrap-files,
 * bootstrap-cache, and bootstrap-hooks functionality.
 *
 * Equivalent: CoreBlow bootstrap-budget.ts (375), bootstrap-files.ts (118),
 *             bootstrap-cache.ts (36), bootstrap-hooks.ts (31) = 560 LOC
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('bootstrap');

// ─── Types ────────────────────────────────────────────────────────

export interface BootstrapBudget {
    /** Maximum tokens for bootstrap context */
    maxTokens: number;
    /** Tokens allocated to system prompt */
    systemPromptTokens: number;
    /** Tokens allocated to context files */
    contextFileTokens: number;
    /** Tokens allocated to skills */
    skillsTokens: number;
    /** Tokens allocated to memory/facts */
    memoryTokens: number;
    /** Remaining tokens */
    remaining: number;
}

export interface BootstrapFile {
    path: string;
    content: string;
    tokenEstimate: number;
    priority: 'required' | 'high' | 'medium' | 'low';
    source: 'workspace' | 'config' | 'skill' | 'memory';
}

export interface BootstrapHook {
    name: string;
    phase: 'pre-boot' | 'post-boot' | 'pre-prompt' | 'post-prompt';
    handler: (context: BootstrapContext) => Promise<void>;
    priority?: number;
}

export interface BootstrapContext {
    workspaceDir: string;
    agentId: string;
    sessionId: string;
    budget: BootstrapBudget;
    files: BootstrapFile[];
}

export interface BootstrapCacheEntry {
    key: string;
    files: BootstrapFile[];
    budget: BootstrapBudget;
    cachedAt: number;
    expiresAt: number;
    hits: number;
}

// ─── Budget Calculator ────────────────────────────────────────────

/**
 * Calculate the bootstrap budget based on context window size
 */
export function calculateBootstrapBudget(params: {
    contextWindowTokens: number;
    systemPromptTokens?: number;
    reserveForResponse?: number;
    reserveForHistory?: number;
}): BootstrapBudget {
    const total = params.contextWindowTokens;
    const responseBudget = params.reserveForResponse ?? Math.min(total * 0.25, 16_000);
    const historyBudget = params.reserveForHistory ?? Math.min(total * 0.4, 50_000);
    const bootstrapBudget = total - responseBudget - historyBudget;

    // Allocate bootstrap budget
    const systemPromptTokens = params.systemPromptTokens ?? Math.min(bootstrapBudget * 0.3, 4_000);
    const remainingAfterSystem = bootstrapBudget - systemPromptTokens;

    const contextFileTokens = Math.floor(remainingAfterSystem * 0.5);
    const skillsTokens = Math.floor(remainingAfterSystem * 0.3);
    const memoryTokens = Math.floor(remainingAfterSystem * 0.2);

    const allocated = systemPromptTokens + contextFileTokens + skillsTokens + memoryTokens;

    return {
        maxTokens: bootstrapBudget,
        systemPromptTokens: Math.round(systemPromptTokens),
        contextFileTokens: Math.round(contextFileTokens),
        skillsTokens: Math.round(skillsTokens),
        memoryTokens: Math.round(memoryTokens),
        remaining: Math.round(bootstrapBudget - allocated),
    };
}

/**
 * Check if a file fits within the remaining budget
 */
export function fitsInBudget(budget: BootstrapBudget, tokenEstimate: number): boolean {
    return budget.remaining >= tokenEstimate;
}

/**
 * Deduct tokens from the budget
 */
export function deductFromBudget(budget: BootstrapBudget, tokens: number, category: keyof BootstrapBudget): BootstrapBudget {
    return {
        ...budget,
        [category]: (budget[category] as number) - tokens,
        remaining: budget.remaining - tokens,
    };
}

// ─── Bootstrap File Manager ──────────────────────────────────────

/**
 * Sort and prioritize bootstrap files to fit within budget
 */
export function prioritizeFiles(
    files: BootstrapFile[],
    budget: BootstrapBudget,
): BootstrapFile[] {
    // Sort by priority then token estimate (smaller first for dense packing)
    const priorityOrder: Record<string, number> = {
        required: 0,
        high: 1,
        medium: 2,
        low: 3,
    };

    const sorted = [...files].sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 99;
        const pb = priorityOrder[b.priority] ?? 99;
        if (pa !== pb) return pa - pb;
        return a.tokenEstimate - b.tokenEstimate;
    });

    const selected: BootstrapFile[] = [];
    let remainingTokens = budget.contextFileTokens;

    for (const file of sorted) {
        if (file.priority === 'required') {
            selected.push(file);
            remainingTokens -= file.tokenEstimate;
            continue;
        }

        if (file.tokenEstimate <= remainingTokens) {
            selected.push(file);
            remainingTokens -= file.tokenEstimate;
        }
    }

    log.debug({ total: files.length, selected: selected.length, remainingTokens }, 'Files prioritized');
    return selected;
}

/**
 * Create a bootstrap file entry
 */
export function createBootstrapFile(
    filePath: string,
    content: string,
    options?: {
        priority?: BootstrapFile['priority'];
        source?: BootstrapFile['source'];
    },
): BootstrapFile {
    // Estimate tokens (roughly 4 chars per token)
    const tokenEstimate = Math.ceil(content.length / 4);

    return {
        path: filePath,
        content,
        tokenEstimate,
        priority: options?.priority ?? 'medium',
        source: options?.source ?? 'workspace',
    };
}

// ─── Bootstrap Cache ──────────────────────────────────────────────

const bootstrapCache = new Map<string, BootstrapCacheEntry>();

/**
 * Get a cached bootstrap result
 */
export function getCachedBootstrap(key: string): BootstrapCacheEntry | null {
    const entry = bootstrapCache.get(key);
    if (!entry) return null;

    if (entry.expiresAt <= Date.now()) {
        bootstrapCache.delete(key);
        return null;
    }

    entry.hits++;
    return entry;
}

/**
 * Cache a bootstrap result
 */
export function cacheBootstrap(
    key: string,
    files: BootstrapFile[],
    budget: BootstrapBudget,
    ttlMs: number = 60_000,
): void {
    bootstrapCache.set(key, {
        key,
        files,
        budget,
        cachedAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
        hits: 0,
    });
    log.debug({ key, fileCount: files.length, ttlMs }, 'Bootstrap cached');
}

/**
 * Clear the bootstrap cache
 */
export function clearBootstrapCache(): void {
    bootstrapCache.clear();
}

/**
 * Get cache statistics
 */
export function getBootstrapCacheStats(): {
    size: number;
    totalHits: number;
    entries: Array<{ key: string; hits: number; expiresIn: number }>;
} {
    const now = Date.now();
    const entries: Array<{ key: string; hits: number; expiresIn: number }> = [];
    let totalHits = 0;

    for (const entry of bootstrapCache.values()) {
        if (entry.expiresAt <= now) {
            bootstrapCache.delete(entry.key);
            continue;
        }
        totalHits += entry.hits;
        entries.push({
            key: entry.key,
            hits: entry.hits,
            expiresIn: entry.expiresAt - now,
        });
    }

    return { size: bootstrapCache.size, totalHits, entries };
}

// ─── Bootstrap Hooks ──────────────────────────────────────────────

const hooks: BootstrapHook[] = [];

/**
 * Register a bootstrap hook
 */
export function registerBootstrapHook(hook: BootstrapHook): void {
    hooks.push(hook);
    hooks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    log.debug({ name: hook.name, phase: hook.phase }, 'Bootstrap hook registered');
}

/**
 * Execute hooks for a specific phase
 */
export async function executeBootstrapHooks(
    phase: BootstrapHook['phase'],
    context: BootstrapContext,
): Promise<void> {
    const phaseHooks = hooks.filter((h) => h.phase === phase);
    for (const hook of phaseHooks) {
        try {
            await hook.handler(context);
            log.debug({ name: hook.name, phase }, 'Bootstrap hook executed');
        } catch (err) {
            log.error({ name: hook.name, phase, error: err instanceof Error ? err.message : String(err) }, 'Bootstrap hook failed');
        }
    }
}

/**
 * Clear all registered hooks
 */
export function clearBootstrapHooks(): void {
    hooks.length = 0;
}

/**
 * List registered hooks
 */
export function listBootstrapHooks(): BootstrapHook[] {
    return [...hooks];
}

// ─── Full Bootstrap Pipeline ──────────────────────────────────────

/**
 * Run the complete bootstrap pipeline for an agent session
 */
export async function runBootstrap(params: {
    workspaceDir: string;
    agentId: string;
    sessionId: string;
    contextWindowTokens: number;
    files?: BootstrapFile[];
    useCache?: boolean;
    cacheTtlMs?: number;
}): Promise<BootstrapContext> {
    const cacheKey = `${params.agentId}:${params.workspaceDir}`;

    // Check cache
    if (params.useCache !== false) {
        const cached = getCachedBootstrap(cacheKey);
        if (cached) {
            log.debug({ cacheKey }, 'Using cached bootstrap');
            return {
                workspaceDir: params.workspaceDir,
                agentId: params.agentId,
                sessionId: params.sessionId,
                budget: cached.budget,
                files: cached.files,
            };
        }
    }

    // Calculate budget
    const budget = calculateBootstrapBudget({
        contextWindowTokens: params.contextWindowTokens,
    });

    // Prioritize files
    const files = prioritizeFiles(params.files ?? [], budget);

    const context: BootstrapContext = {
        workspaceDir: params.workspaceDir,
        agentId: params.agentId,
        sessionId: params.sessionId,
        budget,
        files,
    };

    // Execute pre-boot hooks
    await executeBootstrapHooks('pre-boot', context);

    // Cache result
    if (params.useCache !== false) {
        cacheBootstrap(cacheKey, files, budget, params.cacheTtlMs ?? 60_000);
    }

    // Execute post-boot hooks
    await executeBootstrapHooks('post-boot', context);

    log.info({ agentId: params.agentId, fileCount: files.length, budgetRemaining: budget.remaining }, 'Bootstrap complete');
    return context;
}
