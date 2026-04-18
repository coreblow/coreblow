/** CoreBlow — Configured Binding Match */ export function matchesBinding(channelId: string, pattern: string): boolean { return pattern === "*" || channelId === pattern; }
