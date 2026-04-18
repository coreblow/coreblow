/** CoreBlow — Plugin Target Resolvers */ export function resolveTarget(config: Record<string, unknown>): string | null { return config.target as string ?? null; }
