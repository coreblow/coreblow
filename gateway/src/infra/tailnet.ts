/** CoreBlow — Tailnet */
export function isTailscaleAddress(address: string): boolean { return address.startsWith("100.") || address.endsWith(".ts.net"); }
export function resolveTailscaleHostname(env: NodeJS.ProcessEnv = process.env): string | null { return env.TS_HOSTNAME?.trim() || null; }
