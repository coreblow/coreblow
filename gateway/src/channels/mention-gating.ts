/** CoreBlow — Mention Gating */ export function requiresMention(config: Record<string, unknown>): boolean { return Boolean(config.mentionOnly); }
