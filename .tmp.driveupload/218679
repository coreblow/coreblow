// @ts-nocheck
/**
 * agents/agent-engine.ts
 * AgentEngine — unified facade for the CoreBlow agent runtime.
 *
 * Composes all Phase A modules into a coherent execution engine:
 *   Model selection → System prompt → Tool pipeline → Streaming → Compaction
 */
import {
    type AgentEngineConfig, type TurnResult, type SessionConfig,
    DEFAULT_ENGINE_CONFIG, mergeEngineConfig,
} from './agent-engine-config.js';
import { ToolCatalog, type ToolDefinition as CatalogToolDef } from './tool-catalog.js';
import { ToolPolicy } from './tool-policy.js';
import { Sandbox, createDefaultSandbox } from './sandbox.js';
import { UsageTracker } from './usage.js';
import { InternalEventBus } from './internal-events.js';
import { ModelCatalog } from './model-catalog.js';
import { StreamAccumulator, type StreamChunk, type StreamHandler } from './provider-stream.js';
import { BootstrapCache } from './bootstrap-cache.js';
import { estimateMessagesTokens, pruneHistoryForContextShare, type CompactionMessage } from './compaction.js';
import { detectToolLoop, ToolCircuitBreaker, type ToolCallRecord } from './tool-loop-detection.js';
import { LaneManager } from './lanes.js';
import type { ModelProvider, ToolCall, ConversationMessage, TokenUsage } from './runtime.js';

// ─── Simple Write Lock ───────────────────────────────────────────

class SimpleWriteLock {
    private locked = new Set<string>();
    acquire(id: string): boolean { if (this.locked.has(id)) return false; this.locked.add(id); return true; }
    release(id: string): void { this.locked.delete(id); }
}

// ─── Tool Handler Registry ──────────────────────────────────────

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

interface RegisteredTool {
    catalogDef: CatalogToolDef;
    handler: ToolHandler;
}

// ─── Session State ───────────────────────────────────────────────

export interface EngineSession {
    id: string;
    model: string;
    provider: string;
    messages: ConversationMessage[];
    toolCallHistory: ToolCallRecord[];
    turnCount: number;
    totalTokens: number;
    createdAt: number;
    lastActivityAt: number;
    state: 'idle' | 'running' | 'tool_use' | 'streaming' | 'compacting' | 'error';
    config: SessionConfig;
    abortController: AbortController;
}

// ─── AgentEngine ─────────────────────────────────────────────────

let sessionCounter = 0;
function createSessionId(): string { return `ses_${Date.now()}_${++sessionCounter}`; }

export class AgentEngine {
    readonly config: AgentEngineConfig;
    private sessions = new Map<string, EngineSession>();
    private providers = new Map<string, ModelProvider>();
    private toolCatalog: ToolCatalog;
    private toolHandlers = new Map<string, ToolHandler>();
    private toolPolicy: ToolPolicy;
    private sandbox: Sandbox;
    private usageTracker: UsageTracker;
    private eventBus: InternalEventBus;
    private sessionCache: BootstrapCache<EngineSession>;
    private lanes: LaneManager;
    private writeLock: SimpleWriteLock;
    private circuitBreaker: ToolCircuitBreaker;

    private modelCatalog: import('./model-catalog.js').ModelCatalog;

    constructor(config?: Partial<AgentEngineConfig>) {
        this.config = mergeEngineConfig(config);
        this.toolCatalog = new ToolCatalog();
        this.toolPolicy = new ToolPolicy([
            ...this.config.toolApproval.autoApproveTools.map(t => ({ toolPattern: t, decision: 'allow' as const, priority: 10 })),
            ...this.config.toolApproval.requireApprovalTools.map(t => ({ toolPattern: t, decision: 'require_approval' as const, priority: 10 })),
            ...this.config.toolApproval.denyTools.map(t => ({ toolPattern: t, decision: 'deny' as const, priority: 100 })),
        ]);
        this.sandbox = createDefaultSandbox(this.config.sandboxBaseDir);
        this.usageTracker = new UsageTracker();
        this.eventBus = new InternalEventBus();
        this.sessionCache = new BootstrapCache<EngineSession>(this.config.maxConcurrentSessions);
        this.lanes = new LaneManager(this.config.maxConcurrentSessions);
        this.writeLock = new SimpleWriteLock();
        this.circuitBreaker = new ToolCircuitBreaker(10, 60_000, 3);
        this.modelCatalog = new ModelCatalog();
    }

    // ─── Provider Management ─────────────────────────────────────

    registerProvider(provider: ModelProvider, isDefault?: boolean): void {
        this.providers.set(provider.id, provider);
        if (isDefault) this.config.defaultProvider = provider.id;
    }

    getProvider(id?: string): ModelProvider | null {
        return this.providers.get(id ?? this.config.defaultProvider) ?? null;
    }

    // ─── Tool Registration ───────────────────────────────────────

    registerTool(def: { name: string; description: string; parameters: Record<string, unknown>; handler: ToolHandler }): void {
        this.toolCatalog.register({
            name: def.name,
            description: def.description,
            category: 'custom',
            inputSchema: def.parameters,
            enabled: true,
        });
        this.toolHandlers.set(def.name, def.handler);
    }

    getToolCatalog(): ToolCatalog { return this.toolCatalog; }
    getToolPolicy(): ToolPolicy { return this.toolPolicy; }
    getToolHandler(name: string): ToolHandler | undefined { return this.toolHandlers.get(name); }
    getModelCatalog() { return this.modelCatalog; }

    setSessionModel(sessionId: string, model: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;
        session.model = model;
        return true;
    }

    // ─── Session Management ──────────────────────────────────────

    createSession(sessionConfig?: SessionConfig): string {
        const id = createSessionId();
        const model = sessionConfig?.model ?? this.config.defaultModel ?? DEFAULT_ENGINE_CONFIG.providers[0].defaultModel;
        const provider = sessionConfig?.provider ?? this.config.defaultProvider;

        const session: EngineSession = {
            id, model, provider,
            messages: [],
            toolCallHistory: [],
            turnCount: 0,
            totalTokens: 0,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
            state: 'idle',
            config: sessionConfig ?? {},
            abortController: new AbortController(),
        };

        // Add system prompt
        const systemPrompt = sessionConfig?.systemPrompt ?? this.config.systemPrompt;
        if (systemPrompt) {
            session.messages.push({ role: 'system', content: systemPrompt, timestamp: Date.now() });
        }

        this.sessions.set(id, session);
        this.sessionCache.set(id, session);
        this.eventBus.emitSync('session:created', { sessionId: id });
        return id;
    }

    getSession(id: string): EngineSession | null {
        return this.sessions.get(id) ?? null;
    }

    destroySession(id: string): boolean {
        const session = this.sessions.get(id);
        if (!session) return false;
        session.abortController.abort();
        this.sessions.delete(id);
        this.sessionCache.delete(id);
        this.writeLock.release(id);
        this.eventBus.emitSync('session:destroyed', { sessionId: id });
        return true;
    }

    listSessions(): Array<{ id: string; model: string; state: string; turnCount: number; totalTokens: number }> {
        return Array.from(this.sessions.values()).map(s => ({
            id: s.id, model: s.model, state: s.state, turnCount: s.turnCount, totalTokens: s.totalTokens,
        }));
    }

    // ─── Core: Run Turn ──────────────────────────────────────────

    async runTurn(sessionId: string, userMessage: string, onChunk?: StreamHandler): Promise<TurnResult> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session "${sessionId}" not found`);

        const lockAcquired = this.writeLock.acquire(sessionId);
        if (!lockAcquired) throw new Error(`Session "${sessionId}" is already running`);

        const lane = this.lanes.acquire(sessionId);
        if (!lane) { this.writeLock.release(sessionId); throw new Error('Max concurrent sessions reached'); }

        const startMs = Date.now();
        session.state = 'running';
        session.lastActivityAt = Date.now();
        session.turnCount++;

        const toolCallResults: TurnResult['toolCalls'] = [];

        try {
            // 1. Add user message
            if (userMessage.trim()) {
                session.messages.push({ role: 'user', content: userMessage, timestamp: Date.now() });
            }

            // 2. Compaction check
            let compacted = false;
            if (this.config.enableCompaction) {
                const totalTokens = estimateMessagesTokens(session.messages as CompactionMessage[]);
                if (totalTokens > this.config.maxContextTokens * this.config.compactionThreshold) {
                    session.state = 'compacting';
                    const result = pruneHistoryForContextShare({
                        messages: session.messages as CompactionMessage[],
                        maxContextTokens: this.config.maxContextTokens,
                        maxHistoryShare: this.config.compactionThreshold,
                    });
                    session.messages = result.messages as ConversationMessage[];
                    compacted = true;
                    this.eventBus.emitSync('session:compacted', { sessionId, droppedCount: result.droppedCount });
                }
            }

            // 3. Get provider
            const provider = this.getProvider(session.provider);
            if (!provider) throw new Error(`Provider "${session.provider}" not registered`);

            // 4. Build tool specs for model
            const enabledTools = Array.from(this.toolCatalog.list());
            const tools = enabledTools.map(t => ({
                type: 'function' as const,
                function: { name: t.name, description: t.description, parameters: t.inputSchema as unknown },
            }));

            // 5. Call model
            session.state = 'streaming';
            const response = await provider.chat({
                model: session.model,
                messages: session.messages.map(m => ({
                    role: m.role, content: m.content, name: m.name, tool_call_id: m.toolCallId,
                })),
                tools: tools.length > 0 ? tools : undefined,
                temperature: 0.7,
                max_tokens: this.config.maxOutputTokens,
                stream: this.config.enableStreaming,
            });

            // 6. Track usage
            if (response.usage) {
                session.totalTokens += response.usage.total;
                this.usageTracker.record({
                    inputTokens: response.usage.input, outputTokens: response.usage.output,
                    cost: 0, model: session.model,
                });
            }

            // Stream text to client
            if (response.content && onChunk) {
                onChunk({ type: 'text', content: response.content });
            }

            // 7. Handle tool calls
            if (response.toolCalls && response.toolCalls.length > 0) {
                session.state = 'tool_use';
                session.messages.push({
                    role: 'assistant', content: response.content || '',
                    toolCalls: response.toolCalls, timestamp: Date.now(),
                });

                for (const call of response.toolCalls) {
                    // Tool loop detection
                    if (this.config.enableToolLoopDetection) {
                        const record: ToolCallRecord = { toolName: call.name, argsHash: call.arguments.slice(0, 64), timestamp: Date.now() };
                        session.toolCallHistory.push(record);
                        const loopResult = detectToolLoop(session.toolCallHistory, 10, 4);
                        if (loopResult.loopDetected) {
                            const msg = `Tool loop detected: ${loopResult.type ?? 'repeated calls'}`;
                            session.messages.push({ role: 'tool', content: msg, name: call.name, toolCallId: call.id, timestamp: Date.now() });
                            if (onChunk) onChunk({ type: 'error', content: msg });
                            continue;
                        }
                    }

                    // Policy check
                    const policyResult = this.toolPolicy.evaluate(call.name);
                    if (policyResult.decision === 'deny') {
                        const msg = `Tool "${call.name}" denied by policy`;
                        session.messages.push({ role: 'tool', content: msg, name: call.name, toolCallId: call.id, timestamp: Date.now() });
                        if (onChunk) onChunk({ type: 'error', content: msg });
                        continue;
                    }

                    // Execute tool
                    const toolStart = Date.now();
                    if (onChunk) onChunk({ type: 'tool_use', toolUse: { id: call.id, name: call.name, input: {} } });

                    const handler = this.toolHandlers.get(call.name);
                    let output: string;
                    if (handler) {
                        try {
                            const args = JSON.parse(call.arguments) as Record<string, unknown>;
                            output = await handler(args);
                            this.circuitBreaker.recordSuccess();
                        } catch (err) {
                            output = `Error: ${err instanceof Error ? err.message : String(err)}`;
                            this.circuitBreaker.recordFailure();
                        }
                    } else {
                        output = `Error: Tool "${call.name}" handler not found`;
                    }

                    const toolDuration = Date.now() - toolStart;
                    toolCallResults.push({ id: call.id, name: call.name, input: {}, output, durationMs: toolDuration });
                    session.messages.push({ role: 'tool', content: output, name: call.name, toolCallId: call.id, timestamp: Date.now() });
                }

                // Continue conversation with tool results (recursive turn)
                this.writeLock.release(sessionId);
                this.lanes.release(lane.id);
                const continuedResult = await this.runTurn(sessionId, '', onChunk);
                return { ...continuedResult, toolCalls: [...toolCallResults, ...continuedResult.toolCalls], compacted };
            }

            // 8. Regular response
            session.messages.push({ role: 'assistant', content: response.content, timestamp: Date.now() });
            session.state = 'idle';

            if (onChunk) onChunk({ type: 'done', usage: response.usage ? { inputTokens: response.usage.input, outputTokens: response.usage.output } : undefined });

            return {
                sessionId,
                responseText: response.content,
                toolCalls: toolCallResults,
                usage: {
                    inputTokens: response.usage?.input ?? 0,
                    outputTokens: response.usage?.output ?? 0,
                    totalTokens: response.usage?.total ?? 0,
                    estimatedCost: 0,
                },
                turnNumber: session.turnCount,
                durationMs: Date.now() - startMs,
                finishReason: response.finishReason === 'max_tokens' ? 'max_tokens' : 'end_turn',
                compacted,
            };

        } catch (err) {
            session.state = 'error';
            this.eventBus.emitSync('session:error', { sessionId, error: err instanceof Error ? err.message : String(err) });
            throw err;
        } finally {
            this.writeLock.release(sessionId);
            this.lanes.release(lane.id);
        }
    }

    // ─── Accessors ───────────────────────────────────────────────

    getUsageTracker(): UsageTracker { return this.usageTracker; }
    getEventBus(): InternalEventBus { return this.eventBus; }
    getSandbox(): Sandbox { return this.sandbox; }
    getSessionCount(): number { return this.sessions.size; }

    // ─── Shutdown ────────────────────────────────────────────────

    shutdown(): void {
        for (const session of this.sessions.values()) {
            session.abortController.abort();
        }
        this.sessions.clear();
        this.eventBus.emitSync('engine:shutdown', {});
    }
}
