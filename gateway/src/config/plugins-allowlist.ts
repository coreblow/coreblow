/** CoreBlow — Plugins Allowlist */
const allowlist = new Set<string>();
export function addToPluginAllowlist(pluginName: string): void { allowlist.add(pluginName); }
export function isPluginAllowed(pluginName: string): boolean { return allowlist.size === 0 || allowlist.has(pluginName); }
export function getPluginAllowlist(): string[] { return [...allowlist]; }
