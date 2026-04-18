/** CoreBlow — SCP Host Parser */
export interface ScpTarget { user?: string; host: string; path: string; }
export function parseScpTarget(target: string): ScpTarget | null { const match = /^(?:([^@]+)@)?([^:]+):(.+)$/.exec(target); if (!match) return null; return { user: match[1], host: match[2], path: match[3] }; }
