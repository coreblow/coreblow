/**
 * plugin-sdk/agent-runtime.ts
 * Plugin access to agent lifecycle.
 * Ported from CoreBlow src/plugin-sdk/agent-runtime.ts.
 */

export interface AgentRuntimeContext {
    agentName: string;
    sessionId: string;
    channel: string;
    model: string;
}

export interface AgentRuntimeAPI {
    getActiveAgent(): AgentRuntimeContext | null;
    switchAgent(name: string): Promise<void>;
    getSessionContext(): Record<string, unknown>;
    getConversationHistory(limit?: number): Array<{ role: string; content: string; timestamp: number }>;
    sendMessage(content: string): Promise<void>;
    sendTyping(): void;
}

/**
 * Create an agent runtime API for a plugin.
 */
export function createAgentRuntime(params: {
    getContext: () => AgentRuntimeContext | null;
    sendFn: (content: string) => Promise<void>;
    typingFn: () => void;
    switchFn: (name: string) => Promise<void>;
    historyFn: (limit?: number) => Array<{ role: string; content: string; timestamp: number }>;
    sessionFn: () => Record<string, unknown>;
}): AgentRuntimeAPI {
    return {
        getActiveAgent: params.getContext,
        switchAgent: params.switchFn,
        getSessionContext: params.sessionFn,
        getConversationHistory: params.historyFn,
        sendMessage: params.sendFn,
        sendTyping: params.typingFn,
    };
}
