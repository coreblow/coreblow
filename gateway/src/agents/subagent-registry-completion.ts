/** Subagent completion tracking. */
export interface CompletionRecord { agentId: string; sessionId: string; status: 'success' | 'failure' | 'timeout'; duration: number; timestamp: number; }
const completions: CompletionRecord[] = [];
export function recordCompletion(record: Omit<CompletionRecord, 'timestamp'>): void { completions.push({ ...record, timestamp: Date.now() }); }
export function getCompletions(): readonly CompletionRecord[] { return completions; }
export function clearCompletions(): void { completions.length = 0; }
