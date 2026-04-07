/**
 * agents/subagent-lifecycle-events.ts — Subagent lifecycle event types.
 */
export type SubagentLifecycleEvent = 'spawn' | 'ready' | 'message' | 'tool_use' | 'thinking' | 'complete' | 'error' | 'timeout' | 'killed';
export interface SubagentLifecycleRecord { event: SubagentLifecycleEvent; agentId: string; parentId?: string; sessionId: string; timestamp: number; details?: Record<string, unknown>; }
const lifecycleLog: SubagentLifecycleRecord[] = [];
export function recordLifecycleEvent(record: Omit<SubagentLifecycleRecord, 'timestamp'>): SubagentLifecycleRecord { const r = { ...record, timestamp: Date.now() }; lifecycleLog.push(r); if (lifecycleLog.length > 500) lifecycleLog.splice(0, lifecycleLog.length - 500); return r; }
export function getLifecycleLog(sessionId?: string): SubagentLifecycleRecord[] { return sessionId ? lifecycleLog.filter((r) => r.sessionId === sessionId) : [...lifecycleLog]; }
export function clearLifecycleLog(): void { lifecycleLog.length = 0; }
