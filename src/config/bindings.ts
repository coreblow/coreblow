/**
 * config/bindings.ts
 * Agent ↔ channel binding configuration.
 * Ported from CoreBlow reference src/config/bindings.ts.
 */

export interface AgentRouteBinding {
    type: 'route';
    agent: string;
    channel: string;
    accountId?: string;
    model?: string;
    toolProfile?: string;
}

export interface AgentAcpBinding {
    type: 'acp';
    agent: string;
    provider: string;
    model?: string;
}

export type AgentBinding = AgentRouteBinding | AgentAcpBinding;

function normalizeBindingType(binding: AgentBinding): 'route' | 'acp' {
    return binding.type === 'acp' ? 'acp' : 'route';
}

export function isRouteBinding(binding: AgentBinding): binding is AgentRouteBinding {
    return normalizeBindingType(binding) === 'route';
}

export function isAcpBinding(binding: AgentBinding): binding is AgentAcpBinding {
    return normalizeBindingType(binding) === 'acp';
}

export function listConfiguredBindings(cfg: Record<string, unknown>): AgentBinding[] {
    const bindings = cfg.bindings;
    return Array.isArray(bindings) ? bindings as AgentBinding[] : [];
}

export function listRouteBindings(cfg: Record<string, unknown>): AgentRouteBinding[] {
    return listConfiguredBindings(cfg).filter(isRouteBinding);
}

export function listAcpBindings(cfg: Record<string, unknown>): AgentAcpBinding[] {
    return listConfiguredBindings(cfg).filter(isAcpBinding);
}

/**
 * Find the agent bound to a specific channel+account.
 */
export function resolveAgentForChannel(cfg: Record<string, unknown>, channel: string, accountId?: string): string | undefined {
    const routes = listRouteBindings(cfg);
    // Exact match first (channel + account)
    if (accountId) {
        const exact = routes.find((b) => b.channel === channel && b.accountId === accountId);
        if (exact) return exact.agent;
    }
    // Channel-only match
    const channelMatch = routes.find((b) => b.channel === channel && !b.accountId);
    return channelMatch?.agent;
}

/**
 * Get all channels an agent is bound to.
 */
export function resolveChannelsForAgent(cfg: Record<string, unknown>, agentName: string): string[] {
    return listRouteBindings(cfg)
        .filter((b) => b.agent === agentName)
        .map((b) => b.channel);
}
