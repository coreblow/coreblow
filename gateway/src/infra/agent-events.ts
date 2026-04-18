/**
 * CoreBlow — Agent Events
 *
 * Typed event system for agent lifecycle events.
 * Used by the heartbeat runner, session tracking, and diagnostics.
 */

export type AgentEventType =
  | 'agent:start'
  | 'agent:stop'
  | 'agent:error'
  | 'agent:message'
  | 'agent:reply'
  | 'agent:tool-call'
  | 'agent:heartbeat';

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  sessionId?: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

type AgentEventListener = (event: AgentEvent) => void;

const listeners = new Map<AgentEventType | '*', Set<AgentEventListener>>();

export function onAgentEvent(type: AgentEventType | '*', listener: AgentEventListener): () => void {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(listener);
  return () => { listeners.get(type)?.delete(listener); };
}

export function emitAgentEvent(event: AgentEvent): void {
  listeners.get(event.type)?.forEach((fn) => fn(event));
  listeners.get('*')?.forEach((fn) => fn(event));
}

export function clearAgentEventListeners(): void {
  listeners.clear();
}
