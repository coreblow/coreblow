/**
 * auto-reply/reply/commands-acp/lifecycle.ts
 * ACP lifecycle management in reply context.
 * Follows CoreBlow's commands-acp/lifecycle.ts pattern.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../../../utils/logger.js';

const log = createChildLogger('reply:acp-lifecycle');

export type ACPSessionStatus = 'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface ACPSession {
    id: string;
    agentId: string;
    parentSessionId: string;
    status: ACPSessionStatus;
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    model?: string;
    tools: string[];
    messageCount: number;
    tokensUsed: number;
    error?: string;
}

export interface ACPLifecycleOps {
    createAgent(config: { model?: string; tools?: string[]; systemPrompt?: string }): Promise<string>;
    startAgent(agentId: string): Promise<void>;
    pauseAgent(agentId: string): Promise<void>;
    resumeAgent(agentId: string): Promise<void>;
    stopAgent(agentId: string): Promise<void>;
    getAgentStatus(agentId: string): ACPSessionStatus;
    sendToAgent(agentId: string, message: string): Promise<string>;
}

const sessions = new Map<string, ACPSession>();

/** Start a new ACP session from a reply command. */
export async function acpStart(
    parentSessionId: string,
    config: { model?: string; tools?: string[]; systemPrompt?: string },
    ops: ACPLifecycleOps,
): Promise<ACPSession> {
    const agentId = await ops.createAgent(config);
    const session: ACPSession = {
        id: `acp_${randomUUID().slice(0, 8)}`,
        agentId,
        parentSessionId,
        status: 'initializing',
        createdAt: Date.now(),
        model: config.model,
        tools: config.tools ?? [],
        messageCount: 0,
        tokensUsed: 0,
    };
    sessions.set(session.id, session);

    await ops.startAgent(agentId);
    session.status = 'active';
    session.startedAt = Date.now();

    log.info({ acpId: session.id, agentId, model: config.model }, 'ACP session started');
    return session;
}

/** Pause an active ACP session. */
export async function acpPause(acpId: string, ops: ACPLifecycleOps): Promise<boolean> {
    const session = sessions.get(acpId);
    if (!session || session.status !== 'active') return false;
    await ops.pauseAgent(session.agentId);
    session.status = 'paused';
    log.info({ acpId }, 'ACP session paused');
    return true;
}

/** Resume a paused ACP session. */
export async function acpResume(acpId: string, ops: ACPLifecycleOps): Promise<boolean> {
    const session = sessions.get(acpId);
    if (!session || session.status !== 'paused') return false;
    await ops.resumeAgent(session.agentId);
    session.status = 'active';
    return true;
}

/** Stop an ACP session. */
export async function acpStop(acpId: string, ops: ACPLifecycleOps): Promise<boolean> {
    const session = sessions.get(acpId);
    if (!session) return false;
    await ops.stopAgent(session.agentId);
    session.status = session.status === 'active' ? 'completed' : 'cancelled';
    session.completedAt = Date.now();
    log.info({ acpId, status: session.status }, 'ACP session stopped');
    return true;
}

/** Send a message to an ACP session and get response. */
export async function acpSendMessage(acpId: string, message: string, ops: ACPLifecycleOps): Promise<string | null> {
    const session = sessions.get(acpId);
    if (!session || session.status !== 'active') return null;
    session.messageCount++;
    return ops.sendToAgent(session.agentId, message);
}

/** Get ACP session by ID. */
export function getACPSession(acpId: string): ACPSession | null { return sessions.get(acpId) ?? null; }

/** List all ACP sessions for a parent session. */
export function listACPSessions(parentSessionId: string): ACPSession[] {
    return Array.from(sessions.values()).filter(s => s.parentSessionId === parentSessionId);
}

/** Format ACP session status for reply. */
export function formatACPStatus(session: ACPSession): string {
    const icons: Record<ACPSessionStatus, string> = { initializing: '⏳', active: '🟢', paused: '⏸️', completed: '✅', failed: '❌', cancelled: '🚫' };
    const duration = session.completedAt ? `${((session.completedAt - session.createdAt) / 1000).toFixed(1)}s` : 'running';
    return [
        `${icons[session.status]} ACP Session: ${session.id}`,
        `  Agent: ${session.agentId} | Model: ${session.model ?? 'default'}`,
        `  Status: ${session.status} | Duration: ${duration}`,
        `  Messages: ${session.messageCount} | Tokens: ${session.tokensUsed}`,
        session.tools.length > 0 ? `  Tools: ${session.tools.join(', ')}` : '',
    ].filter(Boolean).join('\n');
}

export function clearACPSessions(): void { sessions.clear(); }
