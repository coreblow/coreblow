/** PI embedded runner — orchestrates the agent loop. */
export interface RunnerState { turnCount: number; isRunning: boolean; lastError?: string; }
export function createRunnerState(): RunnerState { return { turnCount: 0, isRunning: false }; }
export function incrementTurn(state: RunnerState): void { state.turnCount++; }
