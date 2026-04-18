/** CoreBlow — PI Run Setup */ export function setupRun(config: Record<string, unknown>): Record<string, unknown> { return { ...config, startedAt: Date.now() }; }
