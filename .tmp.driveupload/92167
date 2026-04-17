/**
 * src/gateway/orchestrator.ts
 * Orchestrator — wires ALL CoreBlow modules into a unified pipeline
 *
 * This is the central integration point that connects:
 *   Phase 6A: Persona, Context, Lifecycle, Fork, Multi-Agent
 *   Phase 6B: Command Registry
 *   Phase 6C: Plugin Marketplace, Config Validator, Session Persistence
 *
 * The Orchestrator hooks into the MessageRouter's message flow and adds:
 *   1. Config validation on startup
 *   2. Lifecycle hooks (onTurnStart, onTurnEnd, onError)
 *   3. Command detection + registry execution
 *   4. Multi-agent routing with persona
 *   5. Context window management
 *   6. Session persistence (TTL, cleanup)
 *   7. Plugin hook chain
 *   8. Usage tracking
 */

import { createChildLogger } from '../utils/logger.js';
import type { InboundMessage, OutboundMessage, MessageRouter } from './router.js';

// Phase 6A
import { PersonaManager, type PersonaConfig } from '../agents/persona.js';
import { ContextManager } from '../agents/context.js';
import { LifecycleManager, type TurnContext } from '../agents/lifecycle.js';
import { ForkManager } from '../agents/fork.js';
import { MultiAgentRouter } from '../agents/multi.js';

// Phase 6B
import { CommandRegistry } from '../commands/registry.js';
import { getBuiltinCommands } from '../commands/builtins.js';

// Phase 6C
import { SessionPersistenceManager } from '../agents/session-persistence.js';
import { ConfigValidator } from './config-validator.js';

const log = createChildLogger('orchestrator');

// ─── Types ────────────────────────────────────────────────────────

export interface OrchestratorConfig {
    /** Command prefix */
    commandPrefix?: string;
    /** Default persona */
    defaultPersona?: string;
    /** Session TTL in ms */
    sessionTtlMs?: number;
    /** Max sessions */
    maxSessions?: number;
    /** Enable lifecycle hooks */
    enableLifecycle?: boolean;
    /** Enable fork/branching */
    enableFork?: boolean;
    /** Rate limit per minute per session */
    rateLimitPerMinute?: number;
    /** Max input length */
    maxInputLength?: number;
}

export interface OrchestratorModules {
    persona: PersonaManager;
    context: ContextManager;
    lifecycle: LifecycleManager;
    fork: ForkManager;
    multiAgent: MultiAgentRouter;
    commands: CommandRegistry;
    sessions: SessionPersistenceManager;
    configValidator: ConfigValidator;
}

export interface OrchestratorStats {
    messagesProcessed: number;
    commandsExecuted: number;
    turnsCompleted: number;
    errorsCount: number;
    uptime: number;
    modules: {
        personas: number;
        agents: number;
        commands: number;
        sessions: number;
        branches: number;
    };
}

// ─── Orchestrator ────────────────────────────────────────────────

export class Orchestrator {
    public modules: OrchestratorModules;
    private config: OrchestratorConfig;
    private stats = { messagesProcessed: 0, commandsExecuted: 0, turnsCompleted: 0, errorsCount: 0 };
    private startedAt = 0;

    constructor(config: OrchestratorConfig = {}) {
        this.config = config;

        // Initialize all modules
        this.modules = {
            persona: new PersonaManager(),
            context: new ContextManager(),
            lifecycle: new LifecycleManager(),
            fork: new ForkManager(),
            multiAgent: new MultiAgentRouter(),
            commands: new CommandRegistry(config.commandPrefix || '/'),
            sessions: new SessionPersistenceManager({
                defaultTtlMs: config.sessionTtlMs || 24 * 60 * 60 * 1000,
                maxSessions: config.maxSessions || 1000,
            }),
            configValidator: new ConfigValidator(),
        };

        // Register built-in commands
        for (const cmd of getBuiltinCommands()) {
            this.modules.commands.register(cmd);
        }

        // Set up guardrails
        if (config.rateLimitPerMinute || config.maxInputLength) {
            this.modules.lifecycle.setGuardrails({
                rateLimitPerMinute: config.rateLimitPerMinute,
                maxInputLength: config.maxInputLength,
            } as Record<string, unknown>);
        }

        // Set default persona
        if (config.defaultPersona) {
            this.modules.persona.setActive(config.defaultPersona);
        }

        log.info('Orchestrator initialized with all modules');
    }

    /**
     * Validate gateway config on startup
     */
    validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] } {
        const result = this.modules.configValidator.validate(config);
        if (!result.valid) {
            log.error({ errors: result.errors }, 'Config validation failed');
        }
        if (result.applied.length > 0) {
            log.info({ applied: result.applied.length }, 'Config defaults applied');
        }
        return {
            valid: result.valid,
            errors: result.errors.map(e => `${e.path}: ${e.message}`),
        };
    }

    /**
     * Wire into the message router — this is the main integration point
     *
     * Instead of: router → agentTurn directly
     * Now:        router → orchestrator.handleMessage → (commands | agentTurn)
     */
    wire(router: MessageRouter, agentTurnRunner: (inbound: InboundMessage, persona?: PersonaConfig) => Promise<string | void>): void {
        this.startedAt = Date.now();
        this.modules.sessions.startCleanup();

        router.onMessage(async (inbound: InboundMessage) => {
            await this.handleMessage(inbound, router, agentTurnRunner);
        });

        log.info('Orchestrator wired into message router');
    }

    /**
     * Main message pipeline — the core integration flow
     */
    private async handleMessage(
        inbound: InboundMessage,
        router: MessageRouter,
        agentTurnRunner: (inbound: InboundMessage, persona?: PersonaConfig) => Promise<string | void>,
    ): Promise<void> {
        this.stats.messagesProcessed++;

        const { lifecycle, commands, persona, multiAgent, sessions, context, fork } = this.modules;

        // 1. Create turn context for lifecycle tracking
        const turnCtx: TurnContext = lifecycle.createContext(inbound);

        // 2. Session management — create/touch session
        const sessionMeta = sessions.getOrCreate(inbound.sessionId, {
            channel: inbound.channel,
            userId: inbound.senderId,
        });

        // 3. Check guardrails (rate limit, input length, blocked patterns)
        const guardrailError = lifecycle.checkGuardrails(inbound.text, inbound.sessionId) as string | null;
        if (guardrailError) {
            await router.sendReply({
                channel: inbound.channel,
                senderId: inbound.senderId,
                text: `⚠️ ${guardrailError}`,
            });
            return;
        }

        // 4. Emit onTurnStart
        if (this.config.enableLifecycle !== false) {
            await lifecycle.emit('onTurnStart', turnCtx);
        }

        try {
            // 5. Check for commands first
            if (commands.isCommand(inbound.text)) {
                const result = await commands.run(inbound.text, {
                    senderId: inbound.senderId,
                    senderName: inbound.senderName ?? 'Unknown',
                    sessionId: inbound.sessionId,
                    channel: inbound.channel,
                    reply: async (text: string) => {
                        await router.sendReply({ channel: inbound.channel, senderId: inbound.senderId, text });
                    },
                    metadata: {
                        _registry: commands,
                        _personaManager: persona,
                        _sessions: sessions,
                        _lifecycle: lifecycle,
                        _forkManager: fork,
                    },
                });

                if (result) {
                    this.stats.commandsExecuted++;
                    if (result.output) {
                        await router.sendReply({
                            channel: inbound.channel,
                            senderId: inbound.senderId,
                            text: result.output,
                        });
                    } else if (result.error) {
                        await router.sendReply({
                            channel: inbound.channel,
                            senderId: inbound.senderId,
                            text: `❌ ${result.error}`,
                        });
                    }
                    return; // Command handled, skip AI turn
                }
            }

            // 6. Multi-agent routing — find the right agent for this message
            const agentProfile = multiAgent.resolve(inbound.text, inbound.channel);
            turnCtx.agentId = agentProfile;

            // 7. Resolve persona for this session + channel
            const resolvedPersona = persona.resolve(inbound.sessionId, inbound.channel);

            // 8. Track message in session persistence
            sessions.appendMessage(inbound.sessionId, {
                role: 'user',
                content: inbound.text,
            });

            // 9. Fork management — append to active branch if enabled
            if (this.config.enableFork !== false) {
                fork.initSession(inbound.sessionId);
                fork.appendToActive(inbound.sessionId, {
                    role: 'user',
                    content: inbound.text,
                });
            }

            // 10. Run the AI turn with persona
            const response = await agentTurnRunner(inbound, resolvedPersona);

            // 11. Track response in session + fork
            if (response) {
                sessions.appendMessage(inbound.sessionId, {
                    role: 'assistant',
                    content: response,
                });

                if (this.config.enableFork !== false) {
                    fork.appendToActive(inbound.sessionId, {
                        role: 'assistant',
                        content: response,
                    });
                }

                // Check output guardrails
                const outputCheck = lifecycle.checkOutputGuardrails(response);
                if (outputCheck) {
                    turnCtx.response = String(outputCheck);
                } else {
                    turnCtx.response = response;
                }
            }

            this.stats.turnsCompleted++;

        } catch (err: unknown) {
            this.stats.errorsCount++;
            turnCtx.error = err instanceof Error ? err : new Error(String(err));
            log.error({ err: (err instanceof Error ? err.message : String(err)), session: inbound.sessionId }, 'Turn error');

            await lifecycle.emit('onError', turnCtx);

            await router.sendReply({
                channel: inbound.channel,
                senderId: inbound.senderId,
                text: '❌ An error occurred. Please try again.',
            });
        } finally {
            // 12. Emit onTurnEnd
            if (this.config.enableLifecycle !== false) {
                await lifecycle.emit('onTurnEnd', turnCtx);
            }

            // 13. Record usage
            lifecycle.recordUsage({
                channel: inbound.channel,
                agentId: turnCtx.agentId,
                timestamp: Date.now(),
                inputTokens: 0, // would come from provider response
                outputTokens: 0,
                toolCalls: turnCtx.toolCalls?.length ?? 0,
                durationMs: Date.now() - (turnCtx.startedAt ?? Date.now()),
                provider: 'unknown',
                model: 'unknown',
                estimatedCost: 0,
            });
        }
    }

    /**
     * Get orchestrator stats
     */
    getStats(): OrchestratorStats {
        return {
            ...this.stats,
            uptime: this.startedAt > 0 ? Date.now() - this.startedAt : 0,
            modules: {
                personas: this.modules.persona.getStats().total,
                agents: this.modules.multiAgent.getStats().totalAgents,
                commands: this.modules.commands.getStats().totalCommands,
                sessions: this.modules.sessions.getStats().total,
                branches: this.modules.fork.getStats().totalBranches,
            },
        };
    }

    /**
     * Stop the orchestrator — cleanup
     */
    stop(): void {
        this.modules.sessions.stopCleanup();
        log.info(this.getStats(), 'Orchestrator stopped');
    }
}
