/**
 * config/bindings.ts
 * Agent ↔ channel binding configuration.
 * Fully aligned with canonical AgentBinding schema in config/types.agents.ts
 */

import type {
  AgentAcpBinding as CanonicalAgentAcpBinding,
  AgentBinding as CanonicalAgentBinding,
  AgentBindingMatch,
  AgentRouteBinding as CanonicalAgentRouteBinding,
} from "./types.agents.js";

export type AgentRouteBinding = CanonicalAgentRouteBinding & {
  agent?: string;
  channel?: string;
  accountId?: string;
  model?: string;
  toolProfile?: string;
};

export type AgentAcpBinding = CanonicalAgentAcpBinding & {
  agent?: string;
  provider?: string;
  model?: string;
};

export type AgentBinding = AgentRouteBinding | AgentAcpBinding;

function normalizeBindingRecord<T extends Record<string, any>>(b: T): T {
  if (!b || typeof b !== "object") return b;
  const agentId = b.agentId ?? b.agent ?? "";
  const channel = b.match?.channel ?? b.channel ?? "";
  const accountId = b.match?.accountId ?? b.accountId;
  const match = b.match ?? { channel, accountId };

  return {
    ...b,
    agentId,
    agent: agentId,
    match,
    channel,
    accountId,
  };
}

export function isRouteBinding(binding: any): binding is AgentRouteBinding {
  if (!binding || typeof binding !== "object") return false;
  return binding.type === undefined || binding.type === "route";
}

export function isAcpBinding(binding: any): binding is AgentAcpBinding {
  if (!binding || typeof binding !== "object") return false;
  return binding.type === "acp";
}

export function listConfiguredBindings(cfg: Record<string, unknown>): AgentBinding[] {
  const raw = cfg.bindings;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeBindingRecord(item) as AgentBinding);
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
export function resolveAgentForChannel(
  cfg: Record<string, unknown>,
  channel: string,
  accountId?: string,
): string | undefined {
  const routes = listRouteBindings(cfg);
  if (accountId) {
    const exact = routes.find(
      (b) => (b.channel === channel || b.match?.channel === channel) &&
             (b.accountId === accountId || b.match?.accountId === accountId),
    );
    if (exact) return exact.agentId || exact.agent;
  }
  const channelMatch = routes.find(
    (b) => (b.channel === channel || b.match?.channel === channel) &&
           !b.accountId && !b.match?.accountId,
  );
  return channelMatch?.agentId || channelMatch?.agent;
}

/**
 * Get all channels an agent is bound to.
 */
export function resolveChannelsForAgent(
  cfg: Record<string, unknown>,
  agentName: string,
): string[] {
  return listRouteBindings(cfg)
    .filter((b) => (b.agentId === agentName || b.agent === agentName))
    .map((b) => b.channel || b.match?.channel || "")
    .filter(Boolean);
}
