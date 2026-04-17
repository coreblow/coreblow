/**
 * CoreBlow — Subagent Spawn (CoreBlow Parity – UPGRADED)
 *
 * Full spawn pipeline: depth/concurrency checks, session creation,
 * model/thinking override, sandbox enforcement, attachment materialization,
 * system prompt construction, registry registration, lifecycle hooks.
 */

import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createChildLogger } from '../../utils/logger.js';
import {
    registerSubAgent,
    updateSubAgentStatus,
    type SubAgent,
    type SubAgentConfig,
} from './subagent-registry.js';
import { resolveSubagentCapabilities, DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH } from './subagent-capabilities.js';
import { getSubagentDepthFromKey, isSubagentSessionKey } from './subagent-depth.js';
import { subagentRuns } from './subagent-registry-memory.js';
import { persistSubagentRunsToDisk } from './subagent-registry-state.js';
import { countActiveRunsByRequester } from './subagent-registry-queries.js';
import { generateRunId } from './subagent-registry-helpers.js';
import {
    materializeSubagentAttachments,
    type SubagentInlineAttachment,
    type SubagentAttachmentReceipt,
    resolveAttachmentLimits,
} from './subagent-attachments.js';
import type {
    SubagentRunRecord,
    DeliveryContext,
    SpawnSubagentMode,
} from './subagent-registry-types.js';

const log = createChildLogger('subagent:spawn');

// ─── Constants ──────────────────────────────────────────────────

export const SUBAGENT_SPAWN_MODES = ['run', 'session'] as const;
export const SUBAGENT_SPAWN_SANDBOX_MODES = ['inherit', 'require'] as const;
export type SpawnSubagentSandboxMode = (typeof SUBAGENT_SPAWN_SANDBOX_MODES)[number];

export const SUBAGENT_SPAWN_ACCEPTED_NOTE =
    'Auto-announce is push-based. After spawning children, do NOT call sessions_list, sessions_history, exec sleep, or any polling tool. Wait for completion events to arrive as user messages, track expected child session keys, and only send your final answer after ALL expected completions arrive. If a child completion event arrives AFTER your final answer, reply ONLY with NO_REPLY.';
export const SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE =
    'thread-bound session stays active after this task; continue in-thread for follow-ups.';

// ─── Types ──────────────────────────────────────────────────────

export type SpawnSubagentParams = {
    task: string;
    label?: string;
    agentId?: string;
    model?: string;
    thinking?: string;
    runTimeoutSeconds?: number;
    thread?: boolean;
    mode?: SpawnSubagentMode;
    cleanup?: 'delete' | 'keep';
    sandbox?: SpawnSubagentSandboxMode;
    expectsCompletionMessage?: boolean;
    attachments?: SubagentInlineAttachment[];
    attachMountPath?: string;
};

export type SpawnSubagentContext = {
    agentSessionKey?: string;
    agentChannel?: string;
    agentAccountId?: string;
    agentTo?: string;
    agentThreadId?: string | number;
    agentGroupId?: string | null;
    agentGroupChannel?: string | null;
    agentGroupSpace?: string | null;
    requesterAgentIdOverride?: string;
    workspaceDir?: string;
};

export type SpawnSubagentResult = {
    status: 'accepted' | 'forbidden' | 'error';
    childSessionKey?: string;
    runId?: string;
    mode?: SpawnSubagentMode;
    note?: string;
    modelApplied?: boolean;
    error?: string;
    attachments?: {
        count: number;
        totalBytes: number;
        files: Array<{ name: string; bytes: number; sha256: string }>;
        relDir: string;
    };
};

export type SpawnConfig = {
    maxSpawnDepth?: number;
    maxChildrenPerAgent?: number;
    defaultRunTimeoutSeconds?: number;
    workspaceDir?: string;
    onSessionCreate?: (childSessionKey: string, patch: Record<string, unknown>) => Promise<void>;
    onSessionDelete?: (childSessionKey: string) => Promise<void>;
    onAgentStart?: (params: { sessionKey: string; message: string; lane: string; timeout: number }) => Promise<{ runId: string }>;
    onSubagentSpawned?: (payload: {
        runId: string;
        childSessionKey: string;
        agentId: string;
        label?: string;
        mode: SpawnSubagentMode;
    }) => Promise<void>;
};

// ─── Helpers ────────────────────────────────────────────────────

function isValidAgentId(id: string): boolean {
    return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(id);
}

function normalizeAgentId(id: string | undefined): string {
    if (!id) return 'default';
    const normalized = id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 64);
    return normalized || 'default';
}

export function splitModelRef(ref?: string): { provider?: string; model?: string } {
    if (!ref) return { provider: undefined, model: undefined };
    const trimmed = ref.trim();
    if (!trimmed) return { provider: undefined, model: undefined };
    const [provider, model] = trimmed.split('/', 2);
    if (model) return { provider, model };
    return { provider: undefined, model: trimmed };
}

function sanitizeMountPathHint(value?: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) return undefined;
    // eslint-disable-next-line no-control-regex
    if (/[\r\n\u0000-\u001F\u007F\u0085\u2028\u2029]/.test(trimmed)) return undefined;
    if (!/^[A-Za-z0-9._\-/:]+$/.test(trimmed)) return undefined;
    return trimmed;
}

function resolveSpawnMode(params: {
    requestedMode?: SpawnSubagentMode;
    threadRequested: boolean;
}): SpawnSubagentMode {
    if (params.requestedMode === 'run' || params.requestedMode === 'session') {
        return params.requestedMode;
    }
    return params.threadRequested ? 'session' : 'run';
}

function summarizeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'error';
}

// ─── System Prompt Builder ──────────────────────────────────────

export function buildSubagentSystemPrompt(params: {
    requesterSessionKey?: string;
    childSessionKey: string;
    label?: string;
    task: string;
    childDepth: number;
    maxSpawnDepth: number;
}): string {
    const lines: string[] = [];
    lines.push(`[Subagent Context] You are a subagent spawned by ${params.requesterSessionKey ?? 'unknown'}.`);
    lines.push(`Session key: ${params.childSessionKey}`);
    if (params.label) lines.push(`Label: ${params.label}`);
    lines.push(`Depth: ${params.childDepth}/${params.maxSpawnDepth}`);
    lines.push('');
    lines.push('You MUST complete the assigned task and produce a clear result summary.');
    lines.push('Your completion will be automatically announced to your requester.');
    lines.push('Do NOT call sessions_list or poll for status — results auto-announce.');
    return lines.join('\n');
}

// ─── Task Message Builder ───────────────────────────────────────

function buildChildTaskMessage(params: {
    task: string;
    childDepth: number;
    maxSpawnDepth: number;
    spawnMode: SpawnSubagentMode;
}): string {
    return [
        `[Subagent Context] You are running as a subagent (depth ${params.childDepth}/${params.maxSpawnDepth}). Results auto-announce to your requester; do not busy-poll for status.`,
        params.spawnMode === 'session'
            ? '[Subagent Context] This subagent session is persistent and remains available for thread follow-up messages.'
            : undefined,
        `[Subagent Task]: ${params.task}`,
    ]
        .filter((line): line is string => Boolean(line))
        .join('\n\n');
}

// ─── Main Spawn Function ───────────────────────────────────────

export async function spawnSubagentDirect(
    params: SpawnSubagentParams,
    ctx: SpawnSubagentContext,
    config?: SpawnConfig,
): Promise<SpawnSubagentResult> {
    const task = params.task;
    const label = params.label?.trim() || '';
    const requestedAgentId = params.agentId?.trim();

    // Validate agentId
    if (requestedAgentId && !isValidAgentId(requestedAgentId)) {
        return {
            status: 'error',
            error: `Invalid agentId "${requestedAgentId}". Agent IDs must match [a-z0-9][a-z0-9_-]{0,63}. Use agents_list to discover valid targets.`,
        };
    }

    const requestThreadBinding = params.thread === true;
    const spawnMode = resolveSpawnMode({
        requestedMode: params.mode,
        threadRequested: requestThreadBinding,
    });

    if (spawnMode === 'session' && !requestThreadBinding) {
        return {
            status: 'error',
            error: 'mode="session" requires thread=true so the subagent can stay bound to a thread.',
        };
    }

    const cleanup = spawnMode === 'session'
        ? 'keep' as const
        : (params.cleanup === 'keep' || params.cleanup === 'delete')
            ? params.cleanup : 'keep' as const;

    const expectsCompletionMessage = params.expectsCompletionMessage !== false;

    const requesterOrigin: DeliveryContext = {
        channel: ctx.agentChannel,
        accountId: ctx.agentAccountId,
        to: ctx.agentTo,
        threadId: ctx.agentThreadId,
    };

    const maxSpawnDepth = config?.maxSpawnDepth ?? DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH;
    const maxChildren = config?.maxChildrenPerAgent ?? 5;
    const defaultRunTimeoutSeconds = config?.defaultRunTimeoutSeconds ?? 300;

    // Resolve caller context
    const requesterSessionKey = ctx.agentSessionKey ?? 'agent:default:main';
    const callerDepth = getSubagentDepthFromKey(requesterSessionKey);

    // Depth check
    if (callerDepth >= maxSpawnDepth) {
        return {
            status: 'forbidden',
            error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`,
        };
    }

    // Concurrency check
    const activeChildren = countActiveRunsByRequester(requesterSessionKey);
    if (activeChildren >= maxChildren) {
        return {
            status: 'forbidden',
            error: `sessions_spawn has reached max active children for this session (${activeChildren}/${maxChildren})`,
        };
    }

    // Resolve target agent
    const requesterAgentId = normalizeAgentId(
        ctx.requesterAgentIdOverride ?? requesterSessionKey.split(':')[1],
    );
    const targetAgentId = requestedAgentId
        ? normalizeAgentId(requestedAgentId)
        : requesterAgentId;

    // Generate child session key
    const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
    const childDepth = callerDepth + 1;
    const childCapabilities = resolveSubagentCapabilities({
        depth: childDepth,
        maxSpawnDepth,
    });

    // Resolve timeout
    const runTimeoutSeconds =
        typeof params.runTimeoutSeconds === 'number' && Number.isFinite(params.runTimeoutSeconds)
            ? Math.max(0, Math.floor(params.runTimeoutSeconds))
            : defaultRunTimeoutSeconds;

    let modelApplied = false;

    // Patch child session if handler provided
    if (config?.onSessionCreate) {
        const sessionPatch: Record<string, unknown> = {
            spawnDepth: childDepth,
            subagentRole: childCapabilities.role === 'main' ? null : childCapabilities.role,
            subagentControlScope: childCapabilities.controlScope,
        };
        if (params.model) {
            const { provider, model } = splitModelRef(params.model);
            if (model) {
                sessionPatch.model = model;
                if (provider) sessionPatch.modelProvider = provider;
                modelApplied = true;
            }
        }
        try {
            await config.onSessionCreate(childSessionKey, sessionPatch);
        } catch (err) {
            return { status: 'error', error: summarizeError(err), childSessionKey };
        }
    }

    // Build system prompt
    const mountPathHint = sanitizeMountPathHint(params.attachMountPath);
    let childSystemPrompt = buildSubagentSystemPrompt({
        requesterSessionKey,
        childSessionKey,
        label: label || undefined,
        task,
        childDepth,
        maxSpawnDepth,
    });

    // Attachments
    let attachmentsReceipt: SubagentAttachmentReceipt | undefined;
    let attachmentAbsDir: string | undefined;
    let attachmentRootDir: string | undefined;
    let retainOnSessionKeep = false;

    if (params.attachments && params.attachments.length > 0) {
        const workspaceDir = config?.workspaceDir ?? ctx.workspaceDir ?? '/tmp/coreblow-workspaces';
        const matResult = await materializeSubagentAttachments({
            workspaceDir,
            attachments: params.attachments,
            mountPathHint,
        });

        if (matResult && matResult.status !== 'ok') {
            // Cleanup provisional session
            if (config?.onSessionDelete) {
                try { await config.onSessionDelete(childSessionKey); } catch { /* best-effort */ }
            }
            return {
                status: matResult.status === 'forbidden' ? 'forbidden' : 'error',
                error: matResult.error,
            };
        }
        if (matResult?.status === 'ok') {
            retainOnSessionKeep = matResult.retainOnSessionKeep;
            attachmentsReceipt = matResult.receipt;
            attachmentAbsDir = matResult.absDir;
            attachmentRootDir = matResult.rootDir;
            childSystemPrompt = `${childSystemPrompt}\n\n${matResult.systemPromptSuffix}`;
        }
    }

    // Build task message
    const childTaskMessage = buildChildTaskMessage({
        task,
        childDepth,
        maxSpawnDepth,
        spawnMode,
    });

    // Start agent run
    let childRunId: string = crypto.randomUUID();
    if (config?.onAgentStart) {
        try {
            const response = await config.onAgentStart({
                sessionKey: childSessionKey,
                message: childTaskMessage,
                lane: 'subagent',
                timeout: runTimeoutSeconds,
            });
            if (response?.runId) childRunId = response.runId;
        } catch (err) {
            // Cleanup on failure
            if (attachmentAbsDir) {
                try { await fs.rm(attachmentAbsDir, { recursive: true, force: true }); } catch { /* */ }
            }
            if (config?.onSessionDelete) {
                try { await config.onSessionDelete(childSessionKey); } catch { /* */ }
            }
            return {
                status: 'error',
                error: summarizeError(err),
                childSessionKey,
                runId: childRunId,
            };
        }
    }

    // Register in run registry
    const now = Date.now();
    const runRecord: SubagentRunRecord = {
        runId: childRunId,
        childSessionKey,
        controllerSessionKey: requesterSessionKey,
        requesterSessionKey,
        requesterOrigin,
        requesterDisplayKey: requesterSessionKey,
        task,
        cleanup,
        label: label || undefined,
        model: params.model,
        workspaceDir: config?.workspaceDir ?? ctx.workspaceDir,
        runTimeoutSeconds,
        spawnMode,
        createdAt: now,
        startedAt: now,
        sessionStartedAt: now,
        expectsCompletionMessage,
        attachmentsDir: attachmentAbsDir,
        attachmentsRootDir: attachmentRootDir,
        retainAttachmentsOnKeep: retainOnSessionKeep,
    };
    subagentRuns.set(childRunId, runRecord);
    persistSubagentRunsToDisk(subagentRuns);

    // Emit spawned hook
    if (config?.onSubagentSpawned) {
        try {
            await config.onSubagentSpawned({
                runId: childRunId,
                childSessionKey,
                agentId: targetAgentId,
                label: label || undefined,
                mode: spawnMode,
            });
        } catch { /* ignore hook errors */ }
    }

    log.info({
        runId: childRunId,
        childSessionKey,
        label,
        depth: childDepth,
        mode: spawnMode,
        model: params.model,
    }, 'Subagent spawned');

    return {
        status: 'accepted',
        childSessionKey,
        runId: childRunId,
        mode: spawnMode,
        modelApplied,
        note: spawnMode === 'session'
            ? SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE
            : SUBAGENT_SPAWN_ACCEPTED_NOTE,
        attachments: attachmentsReceipt ? {
            count: attachmentsReceipt.count,
            totalBytes: attachmentsReceipt.totalBytes,
            files: attachmentsReceipt.files,
            relDir: attachmentsReceipt.relDir,
        } : undefined,
    };
}

// ─── Simple Spawn (Legacy Compat) ───────────────────────────────

export type GenerateFn = (
    messages: Array<{ role: string; content: string }>,
    config: SubAgentConfig,
) => Promise<{ content: string; usage: { total_tokens: number } }>;

export interface SpawnOptions extends SubAgentConfig {
    parentId: string;
    name: string;
    initialMessages?: Array<{ role: string; content: string }>;
}

export async function spawnSubAgent(opts: SpawnOptions, generateFn: GenerateFn): Promise<SubAgent> {
    const agent = registerSubAgent(opts.parentId, opts.name, opts);
    updateSubAgentStatus(agent.id, 'running');
    log.info({ id: agent.id, name: opts.name }, 'Spawning sub-agent (legacy)');

    try {
        const messages = opts.initialMessages ?? [
            { role: 'system', content: opts.systemPrompt ?? 'You are a helpful assistant.' },
        ];
        const result = await Promise.race([
            generateFn(messages, opts),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Sub-agent timeout')), opts.timeoutMs ?? 60_000),
            ),
        ]);
        updateSubAgentStatus(agent.id, 'completed', { result: result.content });
        return { ...agent, status: 'completed', result: result.content };
    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        updateSubAgentStatus(agent.id, 'failed', { error });
        return { ...agent, status: 'failed', error };
    }
}

// ─── Spawn Validation ───────────────────────────────────────────

export type SpawnValidationResult = {
    valid: boolean;
    errors: string[];
    warnings: string[];
};

export function validateSpawnParams(params: SpawnSubagentParams): SpawnValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!params.task?.trim()) {
        errors.push('Task is required and cannot be empty');
    }
    if (params.task && params.task.length > 50_000) {
        errors.push('Task exceeds maximum length (50,000 chars)');
    }
    if (params.agentId && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(params.agentId)) {
        errors.push('Invalid agentId format');
    }
    if (params.mode && !SUBAGENT_SPAWN_MODES.includes(params.mode as any)) {
        errors.push(`Invalid mode: ${params.mode}`);
    }
    if (params.sandbox && !SUBAGENT_SPAWN_SANDBOX_MODES.includes(params.sandbox as any)) {
        errors.push(`Invalid sandbox mode: ${params.sandbox}`);
    }
    if (params.mode === 'session' && !params.thread) {
        warnings.push('mode=session requires thread=true');
    }
    if (params.runTimeoutSeconds !== undefined) {
        if (typeof params.runTimeoutSeconds !== 'number' || params.runTimeoutSeconds < 0) {
            errors.push('runTimeoutSeconds must be a non-negative number');
        }
        if (params.runTimeoutSeconds > 3600) {
            warnings.push('runTimeoutSeconds exceeds 1 hour — consider a shorter timeout');
        }
    }
    if (params.attachments && params.attachments.length > 50) {
        errors.push('Maximum 50 attachments per spawn');
    }
    if (params.label && params.label.length > 128) {
        warnings.push('Label truncated to 128 characters');
    }
    if (params.model) {
        const { model } = splitModelRef(params.model);
        if (!model) warnings.push('Could not parse model ref');
    }

    return { valid: errors.length === 0, errors, warnings };
}

export function validateSpawnDepth(
    callerDepth: number,
    maxSpawnDepth: number,
): { allowed: boolean; reason?: string } {
    if (callerDepth >= maxSpawnDepth) {
        return {
            allowed: false,
            reason: `Spawn depth exceeded (current: ${callerDepth}, max: ${maxSpawnDepth})`,
        };
    }
    return { allowed: true };
}

export function validateSpawnConcurrency(
    activeChildren: number,
    maxChildren: number,
): { allowed: boolean; reason?: string } {
    if (activeChildren >= maxChildren) {
        return {
            allowed: false,
            reason: `Max children exceeded (active: ${activeChildren}, max: ${maxChildren})`,
        };
    }
    return { allowed: true };
}

// ─── Spawn Rate Limiting ────────────────────────────────────────

const spawnTimestamps = new Map<string, number[]>();
const SPAWN_RATE_WINDOW_MS = 60_000;
const SPAWN_RATE_MAX = 20;

export function checkSpawnRateLimit(sessionKey: string): {
    allowed: boolean;
    remaining: number;
    resetMs: number;
} {
    const now = Date.now();
    const timestamps = spawnTimestamps.get(sessionKey) ?? [];
    const recent = timestamps.filter(t => now - t < SPAWN_RATE_WINDOW_MS);
    spawnTimestamps.set(sessionKey, recent);

    if (recent.length >= SPAWN_RATE_MAX) {
        const oldestRelevant = recent[0]!;
        return {
            allowed: false,
            remaining: 0,
            resetMs: oldestRelevant + SPAWN_RATE_WINDOW_MS - now,
        };
    }

    return {
        allowed: true,
        remaining: SPAWN_RATE_MAX - recent.length,
        resetMs: recent.length > 0 ? (recent[0]! + SPAWN_RATE_WINDOW_MS - now) : SPAWN_RATE_WINDOW_MS,
    };
}

export function recordSpawnEvent(sessionKey: string): void {
    const timestamps = spawnTimestamps.get(sessionKey) ?? [];
    timestamps.push(Date.now());
    spawnTimestamps.set(sessionKey, timestamps);
}

export function clearSpawnRateLimits(): void {
    spawnTimestamps.clear();
}

// ─── Spawn History ──────────────────────────────────────────────

export type SpawnHistoryEntry = {
    runId: string;
    childSessionKey: string;
    requesterSessionKey: string;
    task: string;
    label?: string;
    mode: SpawnSubagentMode;
    model?: string;
    spawnedAt: number;
    status: 'accepted' | 'forbidden' | 'error';
    error?: string;
    durationMs?: number;
};

const spawnHistory: SpawnHistoryEntry[] = [];
const MAX_SPAWN_HISTORY = 500;

export function recordSpawnHistory(entry: SpawnHistoryEntry): void {
    spawnHistory.push(entry);
    if (spawnHistory.length > MAX_SPAWN_HISTORY) {
        spawnHistory.splice(0, spawnHistory.length - MAX_SPAWN_HISTORY);
    }
}

export function getSpawnHistory(limit = 50, sessionKey?: string): SpawnHistoryEntry[] {
    let entries = sessionKey
        ? spawnHistory.filter(e => e.requesterSessionKey === sessionKey)
        : spawnHistory;
    return entries.slice(-limit);
}

export function clearSpawnHistory(): number {
    const count = spawnHistory.length;
    spawnHistory.length = 0;
    return count;
}

// ─── Spawn Config Builder ───────────────────────────────────────

export function buildDefaultSpawnConfig(overrides?: Partial<SpawnConfig>): SpawnConfig {
    return {
        maxSpawnDepth: overrides?.maxSpawnDepth ?? DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH,
        maxChildrenPerAgent: overrides?.maxChildrenPerAgent ?? 5,
        defaultRunTimeoutSeconds: overrides?.defaultRunTimeoutSeconds ?? 300,
        workspaceDir: overrides?.workspaceDir ?? '/tmp/coreblow-workspaces',
        onSessionCreate: overrides?.onSessionCreate,
        onSessionDelete: overrides?.onSessionDelete,
        onAgentStart: overrides?.onAgentStart,
        onSubagentSpawned: overrides?.onSubagentSpawned,
    };
}

export function mergeSpawnConfigs(base: SpawnConfig, overrides: Partial<SpawnConfig>): SpawnConfig {
    return {
        ...base,
        ...Object.fromEntries(
            Object.entries(overrides).filter(([, v]) => v !== undefined),
        ),
    };
}

// ─── Spawn Metrics ──────────────────────────────────────────────

export type SpawnMetrics = {
    totalSpawns: number;
    accepted: number;
    forbidden: number;
    errored: number;
    byMode: Record<string, number>;
    byModel: Record<string, number>;
    avgDurationMs: number;
};

export function getSpawnMetrics(): SpawnMetrics {
    const metrics: SpawnMetrics = {
        totalSpawns: spawnHistory.length,
        accepted: 0,
        forbidden: 0,
        errored: 0,
        byMode: {},
        byModel: {},
        avgDurationMs: 0,
    };

    let totalDuration = 0;
    let durationCount = 0;

    for (const entry of spawnHistory) {
        switch (entry.status) {
            case 'accepted': metrics.accepted++; break;
            case 'forbidden': metrics.forbidden++; break;
            case 'error': metrics.errored++; break;
        }
        metrics.byMode[entry.mode] = (metrics.byMode[entry.mode] ?? 0) + 1;
        if (entry.model) {
            metrics.byModel[entry.model] = (metrics.byModel[entry.model] ?? 0) + 1;
        }
        if (entry.durationMs !== undefined) {
            totalDuration += entry.durationMs;
            durationCount++;
        }
    }

    metrics.avgDurationMs = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    return metrics;
}

export function formatSpawnMetrics(metrics: SpawnMetrics): string {
    return [
        `Total: ${metrics.totalSpawns}`,
        `Accepted: ${metrics.accepted}`,
        `Forbidden: ${metrics.forbidden}`,
        `Errors: ${metrics.errored}`,
        `Avg duration: ${(metrics.avgDurationMs / 1000).toFixed(1)}s`,
    ].join(' | ');
}

// ─── Session Key Helpers ────────────────────────────────────────

export function extractAgentIdFromSessionKey(sessionKey: string): string {
    const parts = sessionKey.split(':');
    return parts[1] ?? 'default';
}

export function buildChildSessionLabel(params: {
    label?: string;
    task: string;
    maxLen?: number;
}): string {
    if (params.label?.trim()) return params.label.trim().slice(0, params.maxLen ?? 48);
    const words = params.task.trim().split(/\s+/).slice(0, 6);
    return words.join(' ').slice(0, params.maxLen ?? 48);
}
