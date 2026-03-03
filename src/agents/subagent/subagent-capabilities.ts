/**
 * CoreBlow — Subagent Capabilities (CoreBlow Parity)
 *
 * Role/scope/depth capability detection for subagent sessions.
 */

import { getSubagentDepthFromSessionStore, isSubagentSessionKey } from './subagent-depth.js';

// ─── Constants ──────────────────────────────────────────────────

export const DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH = 3;

export const SUBAGENT_SESSION_ROLES = ['main', 'orchestrator', 'leaf'] as const;
export type SubagentSessionRole = (typeof SUBAGENT_SESSION_ROLES)[number];

export const SUBAGENT_CONTROL_SCOPES = ['children', 'none'] as const;
export type SubagentControlScope = (typeof SUBAGENT_CONTROL_SCOPES)[number];

// ─── Helpers ────────────────────────────────────────────────────

type SessionCapabilityEntry = {
    sessionId?: unknown;
    spawnDepth?: unknown;
    subagentRole?: unknown;
    subagentControlScope?: unknown;
};

function normalizeSessionKey(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
}

function normalizeSubagentRole(value: unknown): SubagentSessionRole | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    return SUBAGENT_SESSION_ROLES.find(entry => entry === trimmed);
}

function normalizeSubagentControlScope(value: unknown): SubagentControlScope | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().toLowerCase();
    return SUBAGENT_CONTROL_SCOPES.find(entry => entry === trimmed);
}

// ─── Role Resolution ────────────────────────────────────────────

export function resolveSubagentRoleForDepth(params: {
    depth: number;
    maxSpawnDepth?: number;
}): SubagentSessionRole {
    const depth = Number.isInteger(params.depth) ? Math.max(0, params.depth) : 0;
    const maxSpawnDepth =
        typeof params.maxSpawnDepth === 'number' && Number.isFinite(params.maxSpawnDepth)
            ? Math.max(0, Math.floor(params.maxSpawnDepth))
            : DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH;
    if (depth <= 0) {
        // Even main cannot spawn if maxSpawnDepth is 0
        return maxSpawnDepth === 0 ? 'leaf' : 'main';
    }
    return depth < maxSpawnDepth ? 'orchestrator' : 'leaf';
}

export function resolveSubagentControlScopeForRole(
    role: SubagentSessionRole,
): SubagentControlScope {
    return role === 'leaf' ? 'none' : 'children';
}

// ─── Capability Resolution ──────────────────────────────────────

export type SubagentCapabilities = {
    depth: number;
    role: SubagentSessionRole;
    controlScope: SubagentControlScope;
    canSpawn: boolean;
    canControlChildren: boolean;
};

export function resolveSubagentCapabilities(params: {
    depth: number;
    maxSpawnDepth?: number;
}): SubagentCapabilities {
    const role = resolveSubagentRoleForDepth(params);
    const controlScope = resolveSubagentControlScopeForRole(role);
    return {
        depth: Math.max(0, Math.floor(params.depth)),
        role,
        controlScope,
        canSpawn: role === 'main' || role === 'orchestrator',
        canControlChildren: controlScope === 'children',
    };
}

export function resolveStoredSubagentCapabilities(
    sessionKey: string | undefined | null,
    opts?: {
        store?: Record<string, SessionCapabilityEntry>;
        maxSpawnDepth?: number;
    },
): SubagentCapabilities {
    const normalizedSessionKey = normalizeSessionKey(sessionKey);
    const maxSpawnDepth = opts?.maxSpawnDepth ?? DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH;
    const depth = getSubagentDepthFromSessionStore(normalizedSessionKey, {
        store: opts?.store,
    });

    if (!normalizedSessionKey || !isSubagentSessionKey(normalizedSessionKey)) {
        return resolveSubagentCapabilities({ depth, maxSpawnDepth });
    }

    const entry = opts?.store?.[normalizedSessionKey];
    const storedRole = normalizeSubagentRole(entry?.subagentRole);
    const storedControlScope = normalizeSubagentControlScope(entry?.subagentControlScope);
    const fallback = resolveSubagentCapabilities({ depth, maxSpawnDepth });
    const role = storedRole ?? fallback.role;
    const controlScope = storedControlScope ?? resolveSubagentControlScopeForRole(role);

    return {
        depth,
        role,
        controlScope,
        canSpawn: role === 'main' || role === 'orchestrator',
        canControlChildren: controlScope === 'children',
    };
}

// ─── Capability Utilities ───────────────────────────────────────

export function canSpawnAtDepth(depth: number, maxSpawnDepth?: number): boolean {
    const caps = resolveSubagentCapabilities({ depth, maxSpawnDepth });
    return caps.canSpawn;
}

export function describeCapabilities(caps: SubagentCapabilities): string {
    return [
        `Depth: ${caps.depth}`,
        `Role: ${caps.role}`,
        `Scope: ${caps.controlScope}`,
        `Spawn: ${caps.canSpawn ? 'yes' : 'no'}`,
        `Control: ${caps.canControlChildren ? 'yes' : 'no'}`,
    ].join(' | ');
}

export function getMaxChildrenForRole(role: SubagentSessionRole): number {
    switch (role) {
        case 'main': return 10;
        case 'orchestrator': return 5;
        case 'leaf': return 0;
    }
}

export function isSpawnAllowed(params: {
    depth: number;
    activeChildren: number;
    maxSpawnDepth?: number;
    maxChildren?: number;
}): { allowed: boolean; reason?: string } {
    const caps = resolveSubagentCapabilities({ depth: params.depth, maxSpawnDepth: params.maxSpawnDepth });
    if (!caps.canSpawn) {
        return { allowed: false, reason: `Role "${caps.role}" cannot spawn at depth ${caps.depth}` };
    }
    const maxChildren = params.maxChildren ?? getMaxChildrenForRole(caps.role);
    if (params.activeChildren >= maxChildren) {
        return { allowed: false, reason: `Max children reached (${params.activeChildren}/${maxChildren})` };
    }
    return { allowed: true };
}
