/**
 * config/agent-limits.ts
 * Per-agent resource limit enforcement.
 * Ported from OpenClaw src/config/agent-limits.ts.
 */

export const DEFAULT_AGENT_MAX_CONCURRENT = 4;
export const DEFAULT_SUBAGENT_MAX_CONCURRENT = 8;
export const DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 1;
export const DEFAULT_MAX_TURNS_PER_SESSION = 100;
export const DEFAULT_MAX_TOOL_CALLS_PER_TURN = 25;
export const DEFAULT_MAX_TOOL_EXECUTION_MS = 30_000;
export const DEFAULT_MAX_MEMORY_ENTRIES = 1000;
export const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;

function resolvePositiveInt(raw: unknown, fallback: number): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(1, Math.floor(raw));
    }
    return fallback;
}

export function resolveAgentMaxConcurrent(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    return resolvePositiveInt(defaults?.maxConcurrent, DEFAULT_AGENT_MAX_CONCURRENT);
}

export function resolveSubagentMaxConcurrent(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const subagents = defaults?.subagents as Record<string, unknown> | undefined;
    return resolvePositiveInt(subagents?.maxConcurrent, DEFAULT_SUBAGENT_MAX_CONCURRENT);
}

export function resolveSubagentMaxSpawnDepth(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    const subagents = defaults?.subagents as Record<string, unknown> | undefined;
    return resolvePositiveInt(subagents?.maxSpawnDepth, DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH);
}

export function resolveMaxTurnsPerSession(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    return resolvePositiveInt(defaults?.maxTurnsPerSession, DEFAULT_MAX_TURNS_PER_SESSION);
}

export function resolveMaxToolCallsPerTurn(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    return resolvePositiveInt(defaults?.maxToolCallsPerTurn, DEFAULT_MAX_TOOL_CALLS_PER_TURN);
}

export function resolveMaxToolExecutionMs(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    return resolvePositiveInt(defaults?.maxToolExecutionMs, DEFAULT_MAX_TOOL_EXECUTION_MS);
}

export function resolveMaxContextTokens(cfg?: Record<string, unknown>): number {
    const agents = cfg?.agents as Record<string, unknown> | undefined;
    const defaults = agents?.defaults as Record<string, unknown> | undefined;
    return resolvePositiveInt(defaults?.maxContextTokens, DEFAULT_MAX_CONTEXT_TOKENS);
}

export interface AgentLimits {
    maxConcurrent: number;
    subagentMaxConcurrent: number;
    subagentMaxSpawnDepth: number;
    maxTurnsPerSession: number;
    maxToolCallsPerTurn: number;
    maxToolExecutionMs: number;
    maxContextTokens: number;
}

export function resolveAllAgentLimits(cfg?: Record<string, unknown>): AgentLimits {
    return {
        maxConcurrent: resolveAgentMaxConcurrent(cfg),
        subagentMaxConcurrent: resolveSubagentMaxConcurrent(cfg),
        subagentMaxSpawnDepth: resolveSubagentMaxSpawnDepth(cfg),
        maxTurnsPerSession: resolveMaxTurnsPerSession(cfg),
        maxToolCallsPerTurn: resolveMaxToolCallsPerTurn(cfg),
        maxToolExecutionMs: resolveMaxToolExecutionMs(cfg),
        maxContextTokens: resolveMaxContextTokens(cfg),
    };
}
