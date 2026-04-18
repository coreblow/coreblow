/** CoreBlow — CLI Wait */ export function waitMs(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
