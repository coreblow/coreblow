/**
 * src/agents/multi.ts
 * Multi-agent routing — multiple agent personas, routing by channel/pattern
 */

import { AgentManager } from './manager.js';
import { SessionStore } from './sessions.js';
import type { InboundMessage } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('multi-agent');

export interface AgentProfile {
    id: string;
    name: string;
    description: string;
    provider?: string;         // override default provider
    model?: string;            // override default model
    systemPrompt?: string;     // custom system prompt
    channels?: string[];       // restrict to specific channels
    patterns?: RegExp[];       // trigger patterns (e.g., /^@coder /i)
    tools?: string[];          // allowed tool names (whitelist)
    maxTokens?: number;
}

export class MultiAgentRouter {
    private agents: Map<string, AgentProfile> = new Map();
    private defaultAgentId: string = 'default';

    constructor() {
        // Register default agent
        this.register({
            id: 'default',
            name: 'CoreBlow',
            description: 'General-purpose AI assistant',
        });
    }

    /**
     * Register an agent profile
     */
    register(profile: AgentProfile) {
        this.agents.set(profile.id, profile);
        log.info({ id: profile.id, name: profile.name }, 'Agent profile registered');
    }

    /**
     * Set which agent is the default
     */
    setDefault(agentId: string) {
        if (this.agents.has(agentId)) {
            this.defaultAgentId = agentId;
        }
    }

    /**
     * Route an inbound message to the correct agent profile
     * Priority: pattern match → channel match → default
     */
    resolve(message: InboundMessage): AgentProfile {
        // 1. Check pattern matches (e.g., "@coder fix this bug")
        for (const agent of this.agents.values()) {
            if (agent.patterns) {
                for (const pattern of agent.patterns) {
                    if (pattern.test(message.text)) {
                        log.debug({ agent: agent.id, pattern: pattern.source }, 'Pattern match');
                        return agent;
                    }
                }
            }
        }

        // 2. Check channel-specific agents
        for (const agent of this.agents.values()) {
            if (agent.channels?.includes(message.channel)) {
                return agent;
            }
        }

        // 3. Default agent
        return this.agents.get(this.defaultAgentId) || this.agents.values().next().value!;
    }

    /**
     * List all registered agents
     */
    list(): AgentProfile[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get a specific agent
     */
    get(agentId: string): AgentProfile | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Remove an agent profile
     */
    remove(agentId: string): boolean {
        if (agentId === 'default') return false; // can't remove default
        return this.agents.delete(agentId);
    }
}
