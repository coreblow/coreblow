/**
 * agents/subagent-capabilities.ts — Subagent capability declarations.
 */
export type SubagentCapability = 'code' | 'exec' | 'search' | 'browser' | 'files' | 'mcp' | 'image';
export interface SubagentCapabilitySet { capabilities: SubagentCapability[]; maxTools?: number; allowExec?: boolean; sandbox?: boolean; }
export function createCapabilitySet(caps: SubagentCapability[], opts?: { maxTools?: number; allowExec?: boolean; sandbox?: boolean }): SubagentCapabilitySet {
    return { capabilities: caps, maxTools: opts?.maxTools ?? 50, allowExec: opts?.allowExec ?? true, sandbox: opts?.sandbox ?? true };
}
export function hasCapability(set: SubagentCapabilitySet, cap: SubagentCapability): boolean { return set.capabilities.includes(cap); }
export const DEFAULT_CAPABILITIES = createCapabilitySet(['code', 'exec', 'files', 'search']);
