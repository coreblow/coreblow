/**
 * src/agents/manager.ts
 * Agent lifecycle manager — creates providers, resolves config
 */

import { getConfig, type GatewayConfig } from '../gateway/config.js';
import { AgentBootstrap } from './bootstrap.js';
import { SessionStore } from './sessions.js';
import { SkillManager } from './skills.js';
import type { AIProvider } from '../providers/interface.js';
import { OllamaProvider } from '../providers/ollama.js';
import { OpenAIProvider } from '../providers/openai.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('agent-manager');

export class AgentManager {
    public bootstrap: AgentBootstrap;
    public sessions: SessionStore;
    public skills: SkillManager;
    private providers: Map<string, AIProvider> = new Map();

    constructor() {
        this.bootstrap = new AgentBootstrap();
        this.sessions = new SessionStore('default');
        this.skills = new SkillManager();
    }

    /**
     * Initialize the agent system
     */
    async init() {
        const config = getConfig();

        // Ensure workspace exists
        await this.bootstrap.initWorkspace(config.agent.workspace);

        // Load skills
        await this.skills.loadSkills(config.agent.workspace);

        // Initialize providers
        this.initProviders(config);

        log.info('Agent manager initialized');
    }

    /**
     * Get the configured provider
     */
    getProvider(name?: string): AIProvider {
        const providerName = name || getConfig().agent.provider;
        const provider = this.providers.get(providerName);

        if (!provider) {
            // Fallback to Ollama
            log.warn({ requested: providerName }, 'Provider not configured, falling back to Ollama');
            return this.providers.get('ollama') || new OllamaProvider();
        }

        return provider;
    }

    /**
     * Get system prompt for current workspace
     */
    async getSystemPrompt(): Promise<string> {
        const config = getConfig();
        const basePrompt = await this.bootstrap.loadSystemPrompt(config.agent.workspace);
        const skillPrompts = this.skills.getSkillPrompts();

        if (skillPrompts) {
            return `${basePrompt}\n\n${skillPrompts}`;
        }
        return basePrompt;
    }

    /**
     * List available providers and their status
     */
    async getProviderStatus(): Promise<{ name: string; available: boolean }[]> {
        const statuses = [];
        for (const [name, provider] of this.providers) {
            const available = await provider.isAvailable();
            statuses.push({ name, available });
        }
        return statuses;
    }

    private initProviders(config: GatewayConfig) {
        // Ollama (always available — local)
        const ollamaUrl = config.providers.ollama?.baseUrl || 'http://127.0.0.1:11434';
        this.providers.set('ollama', new OllamaProvider(ollamaUrl));

        // OpenAI
        if (config.providers.openai?.apiKey) {
            this.providers.set(
                'openai',
                new OpenAIProvider(
                    config.providers.openai.apiKey,
                    config.providers.openai.baseUrl || 'https://api.openai.com/v1',
                    'openai'
                )
            );
            log.info('OpenAI provider configured');
        }

        // Anthropic
        if (config.providers.anthropic?.apiKey) {
            this.providers.set('anthropic', new AnthropicProvider(config.providers.anthropic.apiKey));
            log.info('Anthropic provider configured');
        }

        // OpenRouter (uses OpenAI-compatible API)
        if (config.providers.openrouter?.apiKey) {
            this.providers.set(
                'openrouter',
                new OpenAIProvider(
                    config.providers.openrouter.apiKey,
                    'https://openrouter.ai/api/v1',
                    'openrouter'
                )
            );
            log.info('OpenRouter provider configured');
        }

        log.info({ providers: Array.from(this.providers.keys()) }, 'Providers initialized');
    }
}
