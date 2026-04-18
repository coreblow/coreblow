/**
 * CoreBlow — Channel Bridge
 *
 * Bridges ANY channel adapter (webhook, discord, telegram, etc.)
 * to the AgentRuntime. Handles session-per-sender mapping,
 * guardrails scanning, and response routing.
 *
 * @packageDocumentation
 */

import { AgentRuntime, type AgentSessionConfig } from '../agents/runtime.js';
import { GuardrailsEngine } from '../security/guardrails.js';

// ─── Types ───────────────────────────────────────────────────────

export interface InboundMessage {
    id: string;
    senderId: string;
    senderName?: string;
    channelId: string;
    channelType: string; // 'webhook', 'discord', 'telegram', etc.
    text: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface OutboundMessage {
    channelId: string;
    text: string;
    replyToId?: string;
    metadata?: Record<string, unknown>;
}

// ─── Channel Bridge ─────────────────────────────────────────────

export class ChannelBridge {
    private runtime: AgentRuntime;
    private guardrails: GuardrailsEngine;
    private senderSessions = new Map<string, string>(); // senderId → sessionId
    private defaultModel: string;
    private defaultProvider: string;

    constructor(
        runtime: AgentRuntime,
        opts?: { defaultModel?: string; defaultProvider?: string },
    ) {
        this.runtime = runtime;
        this.guardrails = new GuardrailsEngine();
        this.defaultModel = opts?.defaultModel ?? 'gpt-4o';
        this.defaultProvider = opts?.defaultProvider ?? 'openai';
    }

    /**
     * Handle an inbound message from any channel.
     * Returns the AI response text.
     */
    async handleInbound(msg: InboundMessage): Promise<OutboundMessage> {
        // 1. Guardrails scan
        const scan = this.guardrails.scan(msg.text);
        if (scan.blocked) {
            return {
                channelId: msg.channelId,
                text: '⚠️ Your message was blocked by CoreBlow safety policy.',
                replyToId: msg.id,
            };
        }

        // 2. Get or create session for this sender
        const sessionId = this.getOrCreateSession(msg.senderId, msg.channelType);
        const session = this.runtime.getSession(sessionId);

        if (!session) {
            return {
                channelId: msg.channelId,
                text: '❌ Internal error: session could not be created.',
                replyToId: msg.id,
            };
        }

        // 3. Run turn
        try {
            const responseText = await session.chat(msg.text);
            return {
                channelId: msg.channelId,
                text: responseText,
                replyToId: msg.id,
            };
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            return {
                channelId: msg.channelId,
                text: `❌ AI provider error: ${errorMsg}`,
                replyToId: msg.id,
            };
        }
    }

    /**
     * Get existing session or create new one for sender.
     */
    private getOrCreateSession(senderId: string, channelType: string): string {
        const existing = this.senderSessions.get(senderId);
        if (existing && this.runtime.getSession(existing)) {
            return existing;
        }

        const sessionId = `ch_${channelType}_${senderId}_${Date.now()}`;
        const config: AgentSessionConfig = {
            model: this.defaultModel,
            provider: this.defaultProvider,
            systemPrompt: 'You are CoreBlow, a helpful AI assistant. Be concise and helpful.',
            maxContextTokens: 128_000,
            maxOutputTokens: 4_096,
            temperature: 0.7,
        };

        this.runtime.createSession(sessionId, config);
        this.senderSessions.set(senderId, sessionId);
        return sessionId;
    }

    /**
     * Reset a sender's session.
     */
    resetSender(senderId: string): boolean {
        const sessionId = this.senderSessions.get(senderId);
        if (sessionId) {
            this.runtime.destroySession(sessionId);
            this.senderSessions.delete(senderId);
            return true;
        }
        return false;
    }

    /**
     * Get stats.
     */
    getStats(): { activeSenders: number; activeSessions: number } {
        return {
            activeSenders: this.senderSessions.size,
            activeSessions: this.runtime.listSessions().length,
        };
    }
}
