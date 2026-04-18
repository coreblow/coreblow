/** CoreBlow — Chutes OAuth */ export function resolveChutesAuth(): string | null { return process.env.CHUTES_API_KEY?.trim() ?? null; }
