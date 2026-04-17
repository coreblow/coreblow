/**
 * CoreBlow Agent Scope Management
 *
 * Manages per-agent configuration overrides, model selection scoping,
 * and agent-specific settings resolution. Each agent can have its own
 * model, tools, and behavior configuration that overrides defaults.
 *
 * Equivalent: CoreBlow src/agents/agent-scope.ts (354 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import type { CoreBlowConfig } from './model-selection.js';

const log = createChildLogger('agent-scope');

// ─── Types ────────────────────────────────────────────────────────

export interface AgentConfig {
    /** Display name */
    name?: string;
    /** Model override for this agent (provider/model) */
    model?: string | { primary?: string; fallback?: string[] };
    /** Model override for subagents spawned by this agent */
    subagents?: {
        model?: string;
        maxConcurrent?: number;
    };
    /** System prompt override */
    systemPrompt?: string;
    /** Extra system prompt appended to default */
    extraSystemPrompt?: string;
    /** Tool policy: which tools are available */
    tools?: {
        allow?: string[];
        deny?: string[];
        exec?: import("../config/config.js").ExecToolConfig;
    };
    /** Max context tokens override */
    maxContextTokens?: number;
    /** Max output tokens override */
    maxOutputTokens?: number;
    /** Temperature override */
    temperature?: number;
    /** Thinking level override */
    thinkingDefault?: string;
    /** Whether this agent is allowed to spawn subagents */
    canSpawnSubagents?: boolean;
    /** Whether this agent can use ACP */
    acpEnabled?: boolean;
    /** Workspace directory override */
    workspaceDir?: string;
    /** Skills prompt override */
    skillsPrompt?: string;
    /** Tags for categorization */
    tags?: string[];
    /** Custom metadata */
    metadata?: Record<string, unknown>;
}

export interface AgentScope {
    agentId: string;
    config: AgentConfig;
    resolvedModel: string | undefined;
    resolvedFallbacks: string[];
    effectiveTools: { allow: string[]; deny: string[] };
}

// ─── Agent Config Registry ────────────────────────────────────────

const agentConfigs = new Map<string, AgentConfig>();

/**
 * Register an agent configuration
 */
export function registerAgentConfig(agentId: string, config: AgentConfig): void {
    agentConfigs.set(normalizeAgentId(agentId), config);
    log.debug({ agentId }, 'Agent config registered');
}

/**
 * Get a registered agent configuration
 */
export function getAgentConfig(agentId: string): AgentConfig | undefined {
    return agentConfigs.get(normalizeAgentId(agentId));
}

/**
 * List all registered agent configurations
 */
export function listAgentConfigs(): Array<{ id: string; config: AgentConfig }> {
    return Array.from(agentConfigs.entries()).map(([id, config]) => ({ id, config }));
}

/**
 * Remove an agent configuration
 */
export function removeAgentConfig(agentId: string): boolean {
    return agentConfigs.delete(normalizeAgentId(agentId));
}

/**
 * Clear all agent configurations
 */
export function clearAgentConfigs(): void {
    agentConfigs.clear();
}

// ─── Agent ID Normalization ───────────────────────────────────────

export function normalizeAgentId(agentId: string): string {
    return agentId.trim().toLowerCase().replace(/\s+/g, '-');
}

export function isValidAgentId(agentId: string): boolean {
    const normalized = normalizeAgentId(agentId);
    return normalized.length > 0
        && normalized.length <= 64
        && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized);
}

// ─── Config Resolution ────────────────────────────────────────────

/**
 * Resolve the effective agent config from global + per-agent settings
 */
export function resolveAgentConfig(cfg: CoreBlowConfig, agentId: string): AgentConfig | undefined {
    const normalized = normalizeAgentId(agentId);

    // Check in-memory registry first
    const registered = agentConfigs.get(normalized);
    if (registered) return registered;

    // Check config file agents section
    const configAgents = (cfg as Record<string, unknown>)?.agents as Record<string, unknown> | undefined;
    const agentEntry = configAgents?.[normalized] as AgentConfig | undefined;
    return agentEntry;
}

/**
 * Resolve the effective model for an agent (agent override → global default)
 */
export function resolveAgentEffectiveModelPrimary(
    cfg: CoreBlowConfig,
    agentId: string,
): string | undefined {
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig?.model) return undefined;

    if (typeof agentConfig.model === 'string') {
        return agentConfig.model.trim() || undefined;
    }
    if (typeof agentConfig.model === 'object' && agentConfig.model.primary) {
        return agentConfig.model.primary.trim() || undefined;
    }
    return undefined;
}

/**
 * Resolve fallback models for an agent
 */
export function resolveAgentModelFallbacksOverride(
    cfg: CoreBlowConfig,
    agentId: string,
): string[] | undefined {
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig?.model) return undefined;

    if (typeof agentConfig.model === 'object' && Array.isArray(agentConfig.model.fallback)) {
        return agentConfig.model.fallback
            .map((f) => (typeof f === 'string' ? f.trim() : ''))
            .filter(Boolean);
    }
    return undefined;
}

/**
 * Resolve the effective tool policy for an agent
 */
export function resolveAgentToolPolicy(
    cfg: CoreBlowConfig,
    agentId: string,
): { allow: string[]; deny: string[] } {
    const agentConfig = resolveAgentConfig(cfg, agentId);
    const defaultAllow = ['*'];
    const defaultDeny: string[] = [];

    if (!agentConfig?.tools) {
        return { allow: defaultAllow, deny: defaultDeny };
    }

    return {
        allow: agentConfig.tools.allow ?? defaultAllow,
        deny: agentConfig.tools.deny ?? defaultDeny,
    };
}

/**
 * Check if a specific tool is allowed for an agent
 */
export function isToolAllowedForAgent(
    cfg: CoreBlowConfig,
    agentId: string,
    toolName: string,
): boolean {
    const policy = resolveAgentToolPolicy(cfg, agentId);
    const normalized = toolName.trim().toLowerCase();

    // Check deny first
    if (policy.deny.some((d) => d === '*' || d.toLowerCase() === normalized)) {
        return false;
    }

    // Check allow
    if (policy.allow.some((a) => a === '*' || a.toLowerCase() === normalized)) {
        return true;
    }

    return false;
}

/**
 * Resolve the full agent scope with all resolved values
 */
export function resolveAgentScope(cfg: CoreBlowConfig, agentId: string): AgentScope {
    const normalized = normalizeAgentId(agentId);
    const config = resolveAgentConfig(cfg, normalized) ?? {};

    return {
        agentId: normalized,
        config,
        resolvedModel: resolveAgentEffectiveModelPrimary(cfg, agentId),
        resolvedFallbacks: resolveAgentModelFallbacksOverride(cfg, agentId) ?? [],
        effectiveTools: resolveAgentToolPolicy(cfg, agentId),
    };
}

/**
 * Merge two agent configs (override wins over base)
 */
export function mergeAgentConfigs(base: AgentConfig, override: AgentConfig): AgentConfig {
    return {
        ...base,
        ...override,
        tools: override.tools ?? base.tools,
        subagents: override.subagents ?? base.subagents,
        metadata: {
            ...(base.metadata ?? {}),
            ...(override.metadata ?? {}),
        },
        tags: override.tags ?? base.tags,
    };
}

/**
 * Validate an agent config
 */
export function validateAgentConfig(config: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.maxContextTokens !== undefined && config.maxContextTokens <= 0) {
        errors.push('maxContextTokens must be positive');
    }
    if (config.maxOutputTokens !== undefined && config.maxOutputTokens <= 0) {
        errors.push('maxOutputTokens must be positive');
    }
    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
        errors.push('temperature must be between 0 and 2');
    }
    if (config.subagents?.maxConcurrent !== undefined && config.subagents.maxConcurrent <= 0) {
        errors.push('subagents.maxConcurrent must be positive');
    }

    return { valid: errors.length === 0, errors };
}
