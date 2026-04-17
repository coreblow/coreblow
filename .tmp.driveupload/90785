/** CLI session management. */
export interface CliSession { id: string; startedAt: number; model: string; provider: string; turnCount: number; }
export function createCliSession(model: string, provider: string): CliSession { return { id: `cli_${Date.now().toString(36)}`, startedAt: Date.now(), model, provider, turnCount: 0 }; }
