/**
 * agents/subagent/subagent-registry.ts
 * Core subagent registry — tracks sub-agents by parent/name with status updates.
 */

import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('subagent:registry');

export type SubAgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SubAgentConfig {
    systemPrompt?: string;
    model?: string;
    provider?: string;
    timeoutMs?: number;
    maxTokens?: number;
}

export interface SubAgent {
    id: string;
    parentId: string;
    name: string;
    status: SubAgentStatus;
    config: SubAgentConfig;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: string;
    error?: string;
}

const agents = new Map<string, SubAgent>();

export function registerSubAgent(parentId: string, name: string, config: SubAgentConfig): SubAgent {
    const id = `${parentId}:${name}:${Date.now()}`;
    const agent: SubAgent = {
        id, parentId, name, config,
        status: 'idle',
        createdAt: Date.now(),
    };
    agents.set(id, agent);
    log.info({ id, parentId, name }, 'Sub-agent registered');
    return agent;
}

export function updateSubAgentStatus(
    id: string,
    status: SubAgentStatus,
    data?: { result?: string; error?: string },
): void {
    const agent = agents.get(id);
    if (!agent) return;
    agent.status = status;
    if (status === 'running') agent.startedAt = Date.now();
    if (status === 'completed' || status === 'failed') agent.completedAt = Date.now();
    if (data?.result) agent.result = data.result;
    if (data?.error) agent.error = data.error;
}

export function getSubAgent(id: string): SubAgent | undefined {
    return agents.get(id);
}

export function listSubAgents(parentId?: string): SubAgent[] {
    const all = [...agents.values()];
    return parentId ? all.filter(a => a.parentId === parentId) : all;
}

export function removeSubAgent(id: string): boolean {
    return agents.delete(id);
}

export function clearSubAgents(): void {
    agents.clear();
}
