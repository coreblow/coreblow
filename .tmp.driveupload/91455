/**
 * agents/identity.ts
 * Agent identity — name, avatar, persona configuration.
 */
export interface AgentIdentity { id: string; name: string; avatar?: string; persona?: string; version?: string; capabilities?: string[]; metadata?: Record<string, unknown>; }
const DEFAULT_IDENTITY: AgentIdentity = { id: 'coreblow', name: 'CoreBlow', persona: 'A helpful AI coding assistant.', version: '1.0.0', capabilities: ['code', 'exec', 'search', 'files'] };
export function resolveIdentity(overrides?: Partial<AgentIdentity>): AgentIdentity { return { ...DEFAULT_IDENTITY, ...overrides }; }
export function formatIdentityPrompt(identity: AgentIdentity): string {
    const lines = [`You are ${identity.name}.`];
    if (identity.persona) lines.push(identity.persona);
    if (identity.capabilities?.length) lines.push(`Capabilities: ${identity.capabilities.join(', ')}`);
    return lines.join(' ');
}
export function formatIdentityBadge(identity: AgentIdentity): string { return `${identity.avatar ?? '🤖'} ${identity.name} v${identity.version ?? '?'}`; }
