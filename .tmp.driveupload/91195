/** CLI runner — main entry point. */
export interface CliRunnerConfig { model?: string; provider?: string; interactive?: boolean; maxTurns?: number; }
export function createCliRunnerConfig(overrides?: Partial<CliRunnerConfig>): CliRunnerConfig { return { interactive: true, maxTurns: 100, ...overrides }; }
