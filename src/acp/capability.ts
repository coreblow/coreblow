/**
 * acp/capability.ts
 */
export interface ACPCapability { name: string; version: string; methods: string[]; } export function negotiateCapabilities(local: ACPCapability[], remote: ACPCapability[]): ACPCapability[] { return local.filter(l => remote.some(r => r.name === l.name && r.version === l.version)); }
