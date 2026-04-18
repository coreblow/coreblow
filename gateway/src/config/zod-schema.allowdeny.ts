/** CoreBlow — Zod Schema: Allow/Deny Lists */
export function validateAllowDenyList(config: Record<string, unknown>): string[] { const errors: string[] = []; if (config.allow !== undefined && !Array.isArray(config.allow)) errors.push("allow must be an array"); if (config.deny !== undefined && !Array.isArray(config.deny)) errors.push("deny must be an array"); return errors; }
