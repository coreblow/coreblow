import { resolveAgentAvatar } from "../../agents/identity-avatar.js";
import { resolveAgentIdentity } from "../../agents/identity.js";
import type { CoreBlowConfig } from "../../config/config.js";

export type OutboundIdentity = {
  name?: string;
  avatarUrl?: string;
  emoji?: string;
  theme?: string;
};

export function normalizeOutboundIdentity(
  identity?: OutboundIdentity | null,
): OutboundIdentity | undefined {
  if (!identity) {
    return undefined;
  }
  const name = identity.name?.trim() || undefined;
  const avatarUrl = identity.avatarUrl?.trim() || undefined;
  const emoji = identity.emoji?.trim() || undefined;
  const theme = identity.theme?.trim() || undefined;
  if (!name && !avatarUrl && !emoji && !theme) {
    return undefined;
  }
  return { name, avatarUrl, emoji, theme };
}

export function resolveAgentOutboundIdentity(
  cfg: CoreBlowConfig,
  agentId: string,
): OutboundIdentity | undefined {
  const agentIdentity = resolveAgentIdentity(cfg, agentId);
  const avatar = resolveAgentAvatar(cfg, agentId);
  return normalizeOutboundIdentity({
    name: agentIdentity?.name,
    emoji: agentIdentity?.emoji,
    avatarUrl: avatar.kind === "remote" ? avatar.url : undefined,
    theme: agentIdentity?.theme,
  });
}

// ---------------------------------------------------------------------------
// OutboundIdentityService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "../service-patterns.js";

export class OutboundIdentityService {
  normalizeOutboundIdentity(params: Parameters<typeof normalizeOutboundIdentity>[0]) {
    return normalizeOutboundIdentity(params);
  }

  resolveAgentOutboundIdentity(cfg: CoreBlowConfig, agentId: string) {
    return resolveAgentOutboundIdentity(cfg, agentId);
  }
}

let _outboundIdentityInstance: OutboundIdentityService | null = null;

export function getOutboundIdentityService(): OutboundIdentityService {
  if (!_outboundIdentityInstance) {
    _outboundIdentityInstance = new OutboundIdentityService();
  }
  return _outboundIdentityInstance;
}

export const __testing_outboundIdentity = createTestingHooks<OutboundIdentityService>(
  () => { _outboundIdentityInstance = null; },
  (svc) => { _outboundIdentityInstance = svc; },
);
