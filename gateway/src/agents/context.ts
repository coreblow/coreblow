/**
 * src/agents/context.ts
 * Advanced context window management
 * SUPERIOR: CoreBlow = naive truncation; CoreBlow = smart budgeting + priorities + cross-session
 */

import { createChildLogger } from '../utils/logger.js';
import type { ChatMessage } from '../providers/interface.js';

const log = createChildLogger('context');

// ─── Types ────────────────────────────────────────────────────────

export interface ContextBudget {
    /** Max total tokens for context window */
    maxTokens: number;
    /** Reserved tokens for system prompt */
    systemReserve: number;
    /** Reserved tokens for model response */
    responseReserve: number;
    /** Available for conversation history */
    historyBudget: number;
}

export interface PinnedMessage {
    message: ChatMessage;
    priority: number; // higher = survives compression longer
    reason: string;
    pinnedAt: number;
}

export interface ContextStats {
    totalMessages: number;
    estimatedTokens: number;
    pinnedCount: number;
    budgetUsed: number;
    budgetRemaining: number;
}

export interface SharedContext {
    id: string;
    summary: string;
    facts: string[];
    createdAt: number;
    sourceSession: string;
}

// ─── Token Estimation ────────────────────────────────────────────

/**
 * Estimate token count from text (rough: ~4 chars per token for English)
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    // Rough heuristic: ~4 chars per token for English, ~2 for CJK
    const cjkCount = (text.match(/[\u3000-\u9fff\uac00-\ud7af]/g) || []).length;
    const nonCjk = text.length - cjkCount;
    return Math.ceil(nonCjk / 4 + cjkCount / 2);
}

/**
 * Estimate tokens for a message array
 */
export function estimateMessageTokens(messages: ChatMessage[]): number {
    let total = 0;
    for (const msg of messages) {
        total += estimateTokens(msg.content || '');
        total += 4; // role overhead
        if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
                total += estimateTokens(tc.function.name + tc.function.arguments);
            }
        }
    }
    return total;
}

// ─── Context Manager ─────────────────────────────────────────────

export class ContextManager {
    private pinned = new Map<string, PinnedMessage[]>(); // sessionId → pinned
    private sharedContexts = new Map<string, SharedContext>();
    private sessionFacts = new Map<string, Set<string>>(); // sessionId → extracted facts

    /**
     * Calculate token budget
     */
    calculateBudget(maxTokens: number = 8192): ContextBudget {
        const systemReserve = 1000;
        const responseReserve = 2000;
        const historyBudget = maxTokens - systemReserve - responseReserve;

        return {
            maxTokens,
            systemReserve,
            responseReserve,
            historyBudget: Math.max(historyBudget, 500),
        };
    }

    /**
     * Smart context window — fits messages within token budget
     * Priority: system > pinned > recent > old
     * SUPERIOR: CoreBlow just truncates from the front
     */
    fitToWindow(
        messages: ChatMessage[],
        budget: ContextBudget,
        sessionId?: string,
    ): ChatMessage[] {
        const system = messages.filter(m => m.role === 'system');
        const nonSystem = messages.filter(m => m.role !== 'system');

        let tokenBudget = budget.historyBudget;

        // 1. Always include system messages
        const systemTokens = estimateMessageTokens(system);
        tokenBudget -= systemTokens;

        // 2. Include pinned messages
        const pinnedMsgs = sessionId ? this.getPinned(sessionId) : [];
        const pinnedChatMsgs = pinnedMsgs
            .sort((a, b) => b.priority - a.priority)
            .map(p => p.message);
        const pinnedTokens = estimateMessageTokens(pinnedChatMsgs);
        tokenBudget -= pinnedTokens;

        // 3. Include shared context as system injection
        const sharedInjections: ChatMessage[] = [];
        if (sessionId) {
            for (const ctx of this.sharedContexts.values()) {
                if (ctx.sourceSession !== sessionId) {
                    const injection: ChatMessage = {
                        role: 'system',
                        content: `[Shared context: ${ctx.summary}]\nFacts: ${ctx.facts.join('; ')}`,
                    };
                    const injTokens = estimateTokens(injection.content || '');
                    if (tokenBudget - injTokens > 500) {
                        sharedInjections.push(injection);
                        tokenBudget -= injTokens;
                    }
                }
            }
        }

        // 4. Fill remaining budget with recent messages (newest first)
        const selected: ChatMessage[] = [];
        for (let i = nonSystem.length - 1; i >= 0; i--) {
            const msg = nonSystem[i];
            // Skip if already pinned
            if (pinnedChatMsgs.includes(msg)) continue;

            const tokens = estimateTokens(msg.content || '') + 4;
            if (tokenBudget - tokens < 0) break;
            tokenBudget -= tokens;
            selected.unshift(msg);
        }

        return [...system, ...sharedInjections, ...pinnedChatMsgs, ...selected];
    }

    /**
     * Pin a message (survives compression)
     */
    pin(sessionId: string, message: ChatMessage, priority: number = 5, reason: string = ''): void {
        const pins = this.pinned.get(sessionId) || [];
        pins.push({ message, priority, reason, pinnedAt: Date.now() });
        this.pinned.set(sessionId, pins);
        log.debug({ sessionId, priority, reason }, 'Message pinned');
    }

    /**
     * Unpin messages for a session
     */
    unpin(sessionId: string, index?: number): void {
        if (index !== undefined) {
            const pins = this.pinned.get(sessionId) || [];
            pins.splice(index, 1);
            this.pinned.set(sessionId, pins);
        } else {
            this.pinned.delete(sessionId);
        }
    }

    /**
     * Get pinned messages for a session
     */
    getPinned(sessionId: string): PinnedMessage[] {
        return this.pinned.get(sessionId) || [];
    }

    /**
     * Add a fact extracted from conversation
     * SUPERIOR: CoreBlow doesn't track per-session facts
     */
    addFact(sessionId: string, fact: string): void {
        const facts = this.sessionFacts.get(sessionId) || new Set();
        facts.add(fact);
        this.sessionFacts.set(sessionId, facts);
    }

    /**
     * Get facts for a session
     */
    getFacts(sessionId: string): string[] {
        return [...(this.sessionFacts.get(sessionId) || [])];
    }

    /**
     * Share context from one session to others
     * SUPERIOR: CoreBlow sessions are completely isolated
     */
    shareContext(sourceSession: string, summary: string, facts: string[]): string {
        const id = `shared_${Date.now()}`;
        this.sharedContexts.set(id, {
            id,
            summary,
            facts,
            createdAt: Date.now(),
            sourceSession: sourceSession,
        });
        log.info({ id, sourceSession, factCount: facts.length }, 'Context shared');
        return id;
    }

    /**
     * Remove a shared context
     */
    removeSharedContext(id: string): boolean {
        return this.sharedContexts.delete(id);
    }

    /**
     * List shared contexts
     */
    listSharedContexts(): SharedContext[] {
        return [...this.sharedContexts.values()];
    }

    /**
     * Get context stats for a session
     */
    getStats(sessionId: string, messages: ChatMessage[]): ContextStats {
        const budget = this.calculateBudget();
        const estimatedTokens = estimateMessageTokens(messages);
        return {
            totalMessages: messages.length,
            estimatedTokens,
            pinnedCount: this.getPinned(sessionId).length,
            budgetUsed: Math.round((estimatedTokens / budget.historyBudget) * 100),
            budgetRemaining: Math.max(0, budget.historyBudget - estimatedTokens),
        };
    }

    /**
     * Clear all data for a session
     */
    clearSession(sessionId: string): void {
        this.pinned.delete(sessionId);
        this.sessionFacts.delete(sessionId);
    }
}
