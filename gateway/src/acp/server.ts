/**
 * src/acp/server.ts
 * ACP Server — both WebSocket (superior) and stdio modes
 * SUPERIOR: OpenClaw = stdio only; CoreBlow = WebSocket + stdio + HTTP REST
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../utils/logger.js';
import { AcpSessionStore } from './session-store.js';
import { extractTextFromPrompt, extractAttachments, inferToolKind, formatToolTitle } from './event-mapper.js';
import {
    ACP_AGENT_INFO,
    PROTOCOL_VERSION,
    type AcpMessage,
    type AcpServerConfig,
    type InitializeResponse,
    type PromptResponse,
    type StopReason,
    type SessionUpdate,
} from './types.js';

const log = createChildLogger('acp:server');

const MAX_PROMPT_BYTES = 2 * 1024 * 1024; // 2MB

interface PendingPrompt {
    sessionId: string;
    sessionKey: string;
    runId: string;
    resolve: (response: PromptResponse) => void;
    reject: (err: Error) => void;
    sentTextLength: number;
    toolCalls: Set<string>;
}

// Rate limiter
class RateLimiter {
    private windowMs: number;
    private maxRequests: number;
    private requests: number[] = [];

    constructor(maxRequests = 120, windowMs = 10_000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
    }

    consume(): { allowed: boolean; retryAfterMs: number } {
        const now = Date.now();
        this.requests = this.requests.filter(t => t > now - this.windowMs);
        if (this.requests.length >= this.maxRequests) {
            const oldest = this.requests[0];
            return { allowed: false, retryAfterMs: oldest + this.windowMs - now };
        }
        this.requests.push(now);
        return { allowed: true, retryAfterMs: 0 };
    }
}

export class AcpServer {
    private sessionStore: AcpSessionStore;
    private config: AcpServerConfig;
    private rateLimiter: RateLimiter;
    private pendingPrompts = new Map<string, PendingPrompt>();
    private connections = new Set<AcpConnection>();
    private onSendToGateway?: (method: string, params: Record<string, unknown>) => Promise<unknown>;
    private started = false;

    constructor(config: AcpServerConfig = {}) {
        this.config = config;
        this.sessionStore = new AcpSessionStore({
            maxSessions: config.maxSessions,
        });
        this.rateLimiter = new RateLimiter(
            config.rateLimit?.maxRequests,
            config.rateLimit?.windowMs,
        );
    }

    /**
     * Set gateway bridge for forwarding chat messages
     */
    setGatewayBridge(bridge: (method: string, params: Record<string, unknown>) => Promise<unknown>) {
        this.onSendToGateway = bridge;
    }

    /**
     * Handle incoming ACP message (from WebSocket or stdio)
     */
    async handleMessage(msg: AcpMessage, conn: AcpConnection): Promise<AcpMessage | null> {
        try {
            switch (msg.type) {
                case 'initialize': return this.handleInitialize(msg);
                case 'new_session': return this.handleNewSession(msg, conn);
                case 'load_session': return this.handleLoadSession(msg);
                case 'list_sessions': return this.handleListSessions(msg);
                case 'prompt': return await this.handlePrompt(msg, conn);
                case 'cancel': return await this.handleCancel(msg);
                default:
                    return { type: 'error', id: msg.id, payload: { message: `Unknown type: ${msg.type}` } };
            }
        } catch (err: any) {
            log.error({ err: err.message, type: msg.type }, 'ACP message error');
            return { type: 'error', id: msg.id, payload: { message: err.message } };
        }
    }

    private handleInitialize(msg: AcpMessage): AcpMessage {
        const response: InitializeResponse = {
            protocolVersion: PROTOCOL_VERSION,
            agentCapabilities: {
                loadSession: true,
                promptCapabilities: {
                    image: true,
                    audio: true,   // SUPERIOR: CoreBlow supports audio
                    video: true,   // SUPERIOR: CoreBlow supports video
                },
                sessionCapabilities: {
                    list: {},
                },
            },
            agentInfo: ACP_AGENT_INFO,
        };
        log.info('ACP initialized');
        return { type: 'initialize_response', id: msg.id, payload: response as any };
    }

    private handleNewSession(msg: AcpMessage, conn: AcpConnection): AcpMessage {
        const budget = this.rateLimiter.consume();
        if (!budget.allowed) {
            throw new Error(`Rate limit exceeded; retry after ${Math.ceil(budget.retryAfterMs / 1000)}s`);
        }

        const cwd = (msg.payload.cwd as string) || process.cwd();
        const sessionKey = (msg.payload.sessionKey as string) || `acp:${randomUUID()}`;

        const session = this.sessionStore.create({ sessionKey, cwd, metadata: msg.payload.metadata as any });
        this.connections.add(conn);

        log.info({ sessionId: session.sessionId, sessionKey }, 'ACP session created');

        return {
            type: 'new_session_response',
            id: msg.id,
            sessionId: session.sessionId,
            payload: { sessionId: session.sessionId },
        };
    }

    private handleLoadSession(msg: AcpMessage): AcpMessage {
        const sessionId = msg.sessionId || (msg.payload.sessionId as string);
        if (!sessionId) throw new Error('sessionId required');

        const cwd = (msg.payload.cwd as string) || process.cwd();
        const sessionKey = (msg.payload.sessionKey as string) || sessionId;

        if (!this.sessionStore.has(sessionId)) {
            const budget = this.rateLimiter.consume();
            if (!budget.allowed) throw new Error('Rate limit exceeded');
        }

        this.sessionStore.create({ sessionId, sessionKey, cwd });
        log.info({ sessionId }, 'ACP session loaded');

        return { type: 'load_session_response', id: msg.id, sessionId, payload: {} };
    }

    private handleListSessions(_msg: AcpMessage): AcpMessage {
        const sessions = this.sessionStore.list().map(s => ({
            sessionId: s.sessionId,
            sessionKey: s.sessionKey,
            cwd: s.cwd,
            createdAt: s.createdAt,
            lastTouchedAt: s.lastTouchedAt,
            hasActiveRun: s.activeRunId !== null,
        }));

        return {
            type: 'list_sessions_response',
            payload: { sessions, count: sessions.length },
        };
    }

    private async handlePrompt(msg: AcpMessage, conn: AcpConnection): Promise<AcpMessage> {
        const sessionId = msg.sessionId || (msg.payload.sessionId as string);
        if (!sessionId) throw new Error('sessionId required');

        const session = this.sessionStore.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);

        // Cancel any active run
        if (session.abortController) {
            this.sessionStore.cancelActiveRun(sessionId);
        }

        const prompt = (msg.payload.prompt as any[]) || [];
        const text = extractTextFromPrompt(prompt, MAX_PROMPT_BYTES);
        const attachments = extractAttachments(prompt);
        const message = `[cwd: ${session.cwd}]\n\n${text}`;

        // Size check
        if (Buffer.byteLength(message, 'utf-8') > MAX_PROMPT_BYTES) {
            throw new Error(`Prompt exceeds ${MAX_PROMPT_BYTES} bytes`);
        }

        const abortController = new AbortController();
        const runId = randomUUID();
        this.sessionStore.setActiveRun(sessionId, runId, abortController);

        // If we have a gateway bridge, forward the prompt
        if (this.onSendToGateway) {
            return new Promise<AcpMessage>((resolve, reject) => {
                this.pendingPrompts.set(sessionId, {
                    sessionId,
                    sessionKey: session.sessionKey,
                    runId,
                    resolve: (resp) => resolve({
                        type: 'prompt_response',
                        id: msg.id,
                        sessionId,
                        payload: resp as any,
                    }),
                    reject: (err) => reject(err),
                    sentTextLength: 0,
                    toolCalls: new Set(),
                });

                this.onSendToGateway!('chat.send', {
                    sessionKey: session.sessionKey,
                    message: text,
                    attachments: attachments.length > 0 ? attachments : undefined,
                    idempotencyKey: runId,
                }).catch((err: any) => {
                    this.pendingPrompts.delete(sessionId);
                    this.sessionStore.clearActiveRun(sessionId);
                    reject(err);
                });
            });
        }

        // Local mode: just echo back
        this.sessionStore.clearActiveRun(sessionId);
        return {
            type: 'prompt_response',
            id: msg.id,
            sessionId,
            payload: { stopReason: 'end_turn' },
        };
    }

    private async handleCancel(msg: AcpMessage): Promise<AcpMessage | null> {
        const sessionId = msg.sessionId || (msg.payload.sessionId as string);
        if (!sessionId) return null;

        const session = this.sessionStore.get(sessionId);
        if (!session) return null;

        this.sessionStore.cancelActiveRun(sessionId);

        if (this.onSendToGateway) {
            try {
                await this.onSendToGateway('chat.abort', { sessionKey: session.sessionKey });
            } catch { }
        }

        const pending = this.pendingPrompts.get(sessionId);
        if (pending) {
            this.pendingPrompts.delete(sessionId);
            pending.resolve({ stopReason: 'cancelled' });
        }

        return null;
    }

    /**
     * Handle gateway events — forward to ACP client as session updates
     */
    async handleGatewayEvent(event: { type: string; sessionKey?: string; data?: Record<string, unknown> }): Promise<void> {
        if (!event.sessionKey) return;

        const pending = this.findPendingBySessionKey(event.sessionKey);
        if (!pending) return;

        if (event.type === 'chat_delta') {
            const content = event.data?.content as any[];
            const fullText = content?.find((c: any) => c.type === 'text')?.text || '';
            const newText = fullText.slice(pending.sentTextLength);

            if (newText) {
                pending.sentTextLength = fullText.length;
                this.broadcastUpdate({
                    sessionId: pending.sessionId,
                    update: {
                        sessionUpdate: 'agent_message_chunk',
                        content: { type: 'text', text: newText },
                    },
                });
            }
        } else if (event.type === 'chat_final') {
            const stopReason: StopReason = (event.data?.stopReason as string) === 'max_tokens' ? 'max_tokens' : 'end_turn';
            this.finishPrompt(pending.sessionId, stopReason);
        } else if (event.type === 'chat_error') {
            this.finishPrompt(pending.sessionId, 'error');
        } else if (event.type === 'tool_start') {
            const toolCallId = event.data?.toolCallId as string;
            const name = event.data?.name as string;
            const args = event.data?.args as Record<string, unknown>;
            if (toolCallId && !pending.toolCalls.has(toolCallId)) {
                pending.toolCalls.add(toolCallId);
                this.broadcastUpdate({
                    sessionId: pending.sessionId,
                    update: {
                        sessionUpdate: 'tool_call',
                        toolCallId,
                        title: formatToolTitle(name, args),
                        status: 'in_progress',
                        rawInput: args,
                        kind: inferToolKind(name),
                    },
                });
            }
        } else if (event.type === 'tool_result') {
            const toolCallId = event.data?.toolCallId as string;
            const isError = Boolean(event.data?.isError);
            if (toolCallId) {
                this.broadcastUpdate({
                    sessionId: pending.sessionId,
                    update: {
                        sessionUpdate: 'tool_call_update',
                        toolCallId,
                        status: isError ? 'failed' : 'completed',
                        rawOutput: event.data?.result,
                    },
                });
            }
        }
    }

    private finishPrompt(sessionId: string, stopReason: StopReason): void {
        const pending = this.pendingPrompts.get(sessionId);
        if (!pending) return;
        this.pendingPrompts.delete(sessionId);
        this.sessionStore.clearActiveRun(sessionId);
        pending.resolve({ stopReason });
    }

    private findPendingBySessionKey(sessionKey: string): PendingPrompt | undefined {
        for (const pending of this.pendingPrompts.values()) {
            if (pending.sessionKey === sessionKey) return pending;
        }
        return undefined;
    }

    private broadcastUpdate(update: SessionUpdate): void {
        const msg: AcpMessage = {
            type: 'session_update',
            sessionId: update.sessionId,
            payload: update as any,
        };
        for (const conn of this.connections) {
            conn.send(msg);
        }
    }

    /**
     * Handle gateway disconnect — reject all pending prompts
     */
    handleDisconnect(reason: string): void {
        for (const pending of this.pendingPrompts.values()) {
            pending.reject(new Error(`Gateway disconnected: ${reason}`));
            this.sessionStore.clearActiveRun(pending.sessionId);
        }
        this.pendingPrompts.clear();
    }

    getSessionStore(): AcpSessionStore {
        return this.sessionStore;
    }

    getStats() {
        return {
            sessions: this.sessionStore.size,
            connections: this.connections.size,
            pendingPrompts: this.pendingPrompts.size,
        };
    }

    close(): void {
        this.handleDisconnect('server closing');
        this.sessionStore.clear();
        this.connections.clear();
        this.started = false;
    }
}

/**
 * Abstract ACP connection interface
 * SUPERIOR: CoreBlow supports both WebSocket and stdio transports
 */
export interface AcpConnection {
    id: string;
    send(msg: AcpMessage): void;
    close(): void;
}

/**
 * WebSocket transport for ACP
 * SUPERIOR: OpenClaw only supports stdio
 */
export class WebSocketAcpConnection implements AcpConnection {
    id: string;
    private ws: any; // WebSocket instance

    constructor(ws: any) {
        this.id = randomUUID();
        this.ws = ws;
    }

    send(msg: AcpMessage): void {
        try {
            this.ws.send(JSON.stringify(msg));
        } catch { }
    }

    close(): void {
        try { this.ws.close(); } catch { }
    }
}

/**
 * Stdio transport for ACP (ndJSON)
 * Compatible with OpenClaw's stdio protocol
 */
export class StdioAcpConnection implements AcpConnection {
    id = 'stdio';

    send(msg: AcpMessage): void {
        process.stdout.write(JSON.stringify(msg) + '\n');
    }

    close(): void {
        // Stdio can't close
    }
}
