/** CoreBlow — Plugins Path Context */ export function extractPluginName(path: string): string | null { const match = /^\/plugins\/([^/]+)/.exec(path); return match?.[1] ?? null; }
