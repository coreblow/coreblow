/** CoreBlow — Plugin Allowlist Match */ export function matchesPluginAllowlist(userId: string, allowlist: string[]): boolean { return allowlist.length === 0 || allowlist.includes(userId); }
