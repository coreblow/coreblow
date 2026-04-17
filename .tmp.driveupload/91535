import type { InboundMessage } from '../gateway/router.js';

export interface ToolCallRecord {
    id: string;
    name: string;
    arguments?: Record<string, unknown>;
    result?: unknown;
}

export interface GuardrailOptions {
    toxicity?: boolean;
    pii?: boolean;
    bias?: boolean;
    customRules?: string[];
}

export interface UsageRecord {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    model?: string;
    cost?: number;
    channel?: string;
    agentId?: string;
    timestamp?: number;
    inputTokens?: number;
    outputTokens?: number;
    toolCalls?: number;
    durationMs?: number;
    provider?: string;
    estimatedCost?: number;
}

export interface TurnContext {
    id: string;
    sessionId: string;
    channelId: string;
    model: string;
    agentId?: string;
    response?: string | Record<string, unknown>;
    error?: Error | string;
    toolCalls?: ToolCallRecord[];
    startedAt?: number;
}

export class LifecycleManager {
    private active = new Map<string, unknown>();

    start(ctx: TurnContext) {
        this.active.set(ctx.sessionId, { ...ctx, startedAt: Date.now() });
        return ctx.sessionId;
    }

    stop(sessionId: string) {
        this.active.delete(sessionId);
    }

    getActive() {
        return [...this.active.values()];
    }

    setGuardrails(options: GuardrailOptions | Record<string, unknown>) {}
    createContext(msg: InboundMessage): TurnContext {
        return {
            id: 'ctx_' + Date.now(),
            sessionId: msg.sessionId,
            channelId: msg.channel,
            model: 'default',
        };
    }
    checkGuardrails(text: string, sessionId?: string): string | null { return null; }
    async emit(event: string, ctx: TurnContext): Promise<void> {}
    checkOutputGuardrails(text: string): string | null { return null; }
    recordUsage(usage: UsageRecord) {}
}
