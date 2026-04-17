/**
 * auto-reply/reply/commands-subagents/shared.ts
 * Sub-agent commands in reply context.
 */

import { createChildLogger } from '../../../utils/logger.js';

const log = createChildLogger('reply:subagent-cmd');

export interface SubAgentCommandResult { success: boolean; message: string; data?: unknown }

export interface SubAgentOps {
    spawn(name: string, config: { model?: string; prompt?: string; tools?: string[] }): Promise<{ id: string; name: string }>;
    list(parentId: string): Array<{ id: string; name: string; status: string; createdAt: number }>;
    cancel(id: string): boolean;
    cancelAll(parentId: string): number;
    getResult(id: string): { content: string; status: string } | null;
    sendMessage(id: string, message: string): Promise<string | null>;
}

/** Handle /subagent spawn <name> [--model X] [--prompt "Y"] */
export async function handleSubAgentSpawn(
    args: string[], parentSessionId: string, ops: SubAgentOps,
): Promise<SubAgentCommandResult> {
    const name = args[0];
    if (!name) return { success: false, message: '❌ Usage: /subagent spawn <name> [--model X] [--prompt "Y"]' };

    const config: Record<string, string | string[]> = {};
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--model' && args[i + 1]) { config.model = args[++i]; }
        else if (args[i] === '--prompt' && args[i + 1]) { config.prompt = args[++i]; }
    }

    const agent = await ops.spawn(name, config as any);
    return { success: true, message: `🤖 Sub-agent spawned: **${agent.name}** (${agent.id})`, data: agent };
}

/** Handle /subagent list */
export function handleSubAgentList(parentSessionId: string, ops: SubAgentOps): SubAgentCommandResult {
    const agents = ops.list(parentSessionId);
    if (agents.length === 0) return { success: true, message: '📋 No active sub-agents.' };
    const lines = agents.map(a => {
        const icon = a.status === 'running' ? '🟢' : a.status === 'completed' ? '✅' : a.status === 'failed' ? '❌' : '⏸️';
        return `  ${icon} ${a.name} (${a.id}) — ${a.status}`;
    });
    return { success: true, message: `📋 Sub-agents (${agents.length}):\n${lines.join('\n')}`, data: agents };
}

/** Handle /subagent cancel <id|all> */
export function handleSubAgentCancel(args: string[], parentSessionId: string, ops: SubAgentOps): SubAgentCommandResult {
    if (args[0] === 'all') {
        const count = ops.cancelAll(parentSessionId);
        return { success: true, message: `🚫 Cancelled ${count} sub-agent(s).` };
    }
    const id = args[0];
    if (!id) return { success: false, message: '❌ Usage: /subagent cancel <id|all>' };
    return ops.cancel(id) ? { success: true, message: `🚫 Sub-agent ${id} cancelled.` } : { success: false, message: `❌ Sub-agent ${id} not found or not running.` };
}

/** Handle /subagent ask <id> <message> */
export async function handleSubAgentAsk(args: string[], ops: SubAgentOps): Promise<SubAgentCommandResult> {
    const id = args[0], message = args.slice(1).join(' ');
    if (!id || !message) return { success: false, message: '❌ Usage: /subagent ask <id> <message>' };
    const response = await ops.sendMessage(id, message);
    return response ? { success: true, message: `🤖 **${id}:** ${response}` } : { success: false, message: `❌ Sub-agent ${id} not available.` };
}

/** Route sub-agent commands. */
export async function handleSubAgentCommand(
    subCommand: string, args: string[], parentSessionId: string, ops: SubAgentOps,
): Promise<SubAgentCommandResult> {
    switch (subCommand) {
        case 'spawn': return handleSubAgentSpawn(args, parentSessionId, ops);
        case 'list': return handleSubAgentList(parentSessionId, ops);
        case 'cancel': return handleSubAgentCancel(args, parentSessionId, ops);
        case 'ask': return handleSubAgentAsk(args, ops);
        default: return { success: false, message: `❌ Unknown: /subagent ${subCommand}. Try: spawn, list, cancel, ask` };
    }
}
