/**
 * commands/batch.ts
 */
export class BatchExecutor { private results: Array<{command: string; result: string}> = []; async executeBatch(commands: string[], executor: (cmd: string) => Promise<string>): Promise<Array<{command: string; result: string}>> { this.results = []; for (const cmd of commands) { const result = await executor(cmd); this.results.push({command: cmd, result}); } return this.results; } }
