/**
 * CoreBlow OpenAI WebSocket Streaming
 *
 * Manages WebSocket connections to OpenAI's realtime API for streaming
 * chat completions and audio responses. Handles connection lifecycle,
 * message framing, heartbeats, and reconnection.
 *
 * Consolidates: CoreBlow openai-ws-stream.ts (643) + openai-ws-connection.ts (561) = 1,204 LOC.
 */

import { createChildLogger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

const log = createChildLogger('openai-ws');

// ─── Types ────────────────────────────────────────────────────────

export type WSConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';

export interface WSConnectionOptions {
    url: string;
    apiKey: string;
    model: string;
    headers?: Record<string, string>;
    reconnectAttempts?: number;
    reconnectDelayMs?: number;
    heartbeatIntervalMs?: number;
    timeoutMs?: number;
}

export interface WSMessage {
    type: string;
    data: unknown;
    timestamp: number;
    id?: string;
}

export interface WSStreamDelta {
    type: 'text' | 'audio' | 'function_call' | 'function_result' | 'error';
    content: string;
    index: number;
    finished: boolean;
    metadata?: Record<string, unknown>;
}

export interface WSStreamStats {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    reconnects: number;
    errors: number;
    connectedAt?: number;
    latencyMs?: number;
}

// ─── WebSocket Connection Manager ─────────────────────────────────

export class WSConnectionManager extends EventEmitter {
    private ws: WebSocket | null = null;
    private state: WSConnectionState = 'disconnected';
    private options: Required<WSConnectionOptions>;
    private stats: WSStreamStats = {
        messagesReceived: 0,
        messagesSent: 0,
        bytesReceived: 0,
        bytesSent: 0,
        reconnects: 0,
        errors: 0,
    };
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempt = 0;
    private messageBuffer: WSMessage[] = [];

    constructor(options: WSConnectionOptions) {
        super();
        this.options = {
            url: options.url,
            apiKey: options.apiKey,
            model: options.model,
            headers: options.headers ?? {},
            reconnectAttempts: options.reconnectAttempts ?? 5,
            reconnectDelayMs: options.reconnectDelayMs ?? 1000,
            heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30_000,
            timeoutMs: options.timeoutMs ?? 30_000,
        };
    }

    /**
     * Connect to the WebSocket server
     */
    async connect(): Promise<void> {
        if (this.state === 'connected' || this.state === 'connecting') {
            log.warn('Already connected or connecting');
            return;
        }

        this.setState('connecting');

        try {
            // Use native WebSocket (available in Node 22+)
            const url = new URL(this.options.url);
            url.searchParams.set('model', this.options.model);

            this.ws = new WebSocket(url.toString(), {
                headers: {
                    Authorization: `Bearer ${this.options.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1',
                    ...this.options.headers,
                },
            } as unknown as string);

            this.setupListeners();

            // Wait for connection or timeout
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.options.timeoutMs);

                const onOpen = () => {
                    clearTimeout(timer);
                    resolve();
                };
                const onError = (err: Event) => {
                    clearTimeout(timer);
                    reject(new Error(`Connection failed: ${(err as unknown as { message?: string }).message ?? 'unknown'}`));
                };

                this.ws!.addEventListener('open', onOpen, { once: true });
                this.ws!.addEventListener('error', onError, { once: true });
            });

            this.setState('connected');
            this.stats.connectedAt = Date.now();
            this.reconnectAttempt = 0;
            this.startHeartbeat();

            log.info({ url: this.options.url, model: this.options.model }, 'WebSocket connected');
        } catch (err) {
            this.setState('error');
            this.stats.errors++;
            const message = err instanceof Error ? err.message : String(err);
            log.error({ error: message }, 'WebSocket connection failed');
            this.emit('error', err);
            throw err;
        }
    }

    /**
     * Disconnect from the WebSocket server
     */
    disconnect(): void {
        this.stopHeartbeat();
        this.clearReconnectTimer();

        if (this.ws) {
            try {
                this.ws.close(1000, 'Client disconnect');
            } catch {
                // Ignore close errors
            }
            this.ws = null;
        }

        this.setState('closed');
        log.info('WebSocket disconnected');
    }

    /**
     * Send a message
     */
    send(message: WSMessage): boolean {
        if (!this.ws || this.state !== 'connected') {
            this.messageBuffer.push(message);
            return false;
        }

        try {
            const data = JSON.stringify(message);
            this.ws.send(data);
            this.stats.messagesSent++;
            this.stats.bytesSent += data.length;
            return true;
        } catch (err) {
            log.error({ error: (err as Error).message }, 'Send failed');
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Send a chat completion request
     */
    sendChatMessage(content: string, options?: {
        role?: 'user' | 'system';
        audio?: boolean;
    }): boolean {
        return this.send({
            type: 'conversation.item.create',
            data: {
                type: 'message',
                role: options?.role ?? 'user',
                content: [{ type: 'input_text', text: content }],
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Request a response generation
     */
    requestResponse(options?: {
        modalities?: string[];
        instructions?: string;
    }): boolean {
        return this.send({
            type: 'response.create',
            data: {
                modalities: options?.modalities ?? ['text'],
                instructions: options?.instructions,
            },
            timestamp: Date.now(),
        });
    }

    /**
     * Get current connection state
     */
    getState(): WSConnectionState {
        return this.state;
    }

    /**
     * Get stream statistics
     */
    getStats(): WSStreamStats {
        return { ...this.stats };
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.state === 'connected' && this.ws !== null;
    }

    // ─── Private ──────────────────────────────────────────────────

    private setState(state: WSConnectionState): void {
        const prev = this.state;
        this.state = state;
        this.emit('stateChange', { from: prev, to: state });
    }

    private setupListeners(): void {
        if (!this.ws) return;

        this.ws.addEventListener('message', (event) => {
            try {
                const data = typeof event.data === 'string'
                    ? event.data
                    : event.data.toString();
                this.stats.messagesReceived++;
                this.stats.bytesReceived += data.length;

                const parsed = JSON.parse(data);
                this.handleMessage(parsed);
            } catch (err) {
                log.error({ error: (err as Error).message }, 'Message parse error');
            }
        });

        this.ws.addEventListener('close', (event) => {
            log.info({ code: event.code, reason: event.reason }, 'WebSocket closed');
            this.stopHeartbeat();

            if (this.state !== 'closed' && event.code !== 1000) {
                this.attemptReconnect();
            } else {
                this.setState('disconnected');
            }
        });

        this.ws.addEventListener('error', (event) => {
            this.stats.errors++;
            log.error({ error: (event as unknown as { message?: string }).message ?? 'unknown' }, 'WebSocket error');
            this.emit('error', event);
        });
    }

    private handleMessage(data: Record<string, unknown>): void {
        const type = String(data.type ?? '');

        switch (type) {
            case 'response.text.delta':
                this.emit('delta', {
                    type: 'text',
                    content: String((data as Record<string, unknown>).delta ?? ''),
                    index: 0,
                    finished: false,
                } satisfies WSStreamDelta);
                break;

            case 'response.audio.delta':
                this.emit('delta', {
                    type: 'audio',
                    content: String((data as Record<string, unknown>).delta ?? ''),
                    index: 0,
                    finished: false,
                } satisfies WSStreamDelta);
                break;

            case 'response.text.done':
            case 'response.done':
                this.emit('delta', {
                    type: 'text',
                    content: '',
                    index: 0,
                    finished: true,
                } satisfies WSStreamDelta);
                this.emit('responseComplete', data);
                break;

            case 'error':
                this.emit('delta', {
                    type: 'error',
                    content: String((data as Record<string, unknown>).error ?? 'Unknown error'),
                    index: 0,
                    finished: true,
                } satisfies WSStreamDelta);
                this.emit('streamError', data);
                break;

            case 'session.created':
            case 'session.updated':
                this.emit('sessionEvent', data);
                break;

            default:
                this.emit('message', data);
                break;
        }
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected()) {
                this.send({
                    type: 'ping',
                    data: {},
                    timestamp: Date.now(),
                });
            }
        }, this.options.heartbeatIntervalMs);

        if (this.heartbeatTimer && typeof this.heartbeatTimer === 'object' && 'unref' in this.heartbeatTimer) {
            (this.heartbeatTimer as NodeJS.Timeout).unref();
        }
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempt >= this.options.reconnectAttempts) {
            log.error({ attempts: this.reconnectAttempt }, 'Max reconnect attempts reached');
            this.setState('error');
            this.emit('maxReconnectsReached');
            return;
        }

        this.reconnectAttempt++;
        this.stats.reconnects++;
        this.setState('reconnecting');

        const delay = this.options.reconnectDelayMs * Math.pow(2, this.reconnectAttempt - 1);
        log.info({ attempt: this.reconnectAttempt, delayMs: delay }, 'Reconnecting...');

        this.reconnectTimer = setTimeout(async () => {
            try {
                await this.connect();
                // Flush buffered messages
                this.flushMessageBuffer();
            } catch {
                this.attemptReconnect();
            }
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private flushMessageBuffer(): void {
        const buffered = [...this.messageBuffer];
        this.messageBuffer = [];
        for (const msg of buffered) {
            this.send(msg);
        }
        if (buffered.length > 0) {
            log.debug({ count: buffered.length }, 'Flushed buffered messages');
        }
    }
}

// ─── Stream Processor ─────────────────────────────────────────────

/**
 * Create a stream processor for OpenAI WebSocket responses
 */
export function createStreamProcessor(connection: WSConnectionManager): {
    onDelta: (handler: (delta: WSStreamDelta) => void) => void;
    onComplete: (handler: (data: unknown) => void) => void;
    onError: (handler: (error: unknown) => void) => void;
    getAccumulatedText: () => string;
    destroy: () => void;
} {
    let accumulatedText = '';
    const deltaHandlers: Array<(delta: WSStreamDelta) => void> = [];
    const completeHandlers: Array<(data: unknown) => void> = [];
    const errorHandlers: Array<(error: unknown) => void> = [];

    const onDeltaInternal = (delta: WSStreamDelta) => {
        if (delta.type === 'text') {
            accumulatedText += delta.content;
        }
        for (const handler of deltaHandlers) {
            handler(delta);
        }
    };

    const onCompleteInternal = (data: unknown) => {
        for (const handler of completeHandlers) {
            handler(data);
        }
    };

    const onErrorInternal = (error: unknown) => {
        for (const handler of errorHandlers) {
            handler(error);
        }
    };

    connection.on('delta', onDeltaInternal);
    connection.on('responseComplete', onCompleteInternal);
    connection.on('streamError', onErrorInternal);

    return {
        onDelta: (handler) => deltaHandlers.push(handler),
        onComplete: (handler) => completeHandlers.push(handler),
        onError: (handler) => errorHandlers.push(handler),
        getAccumulatedText: () => accumulatedText,
        destroy: () => {
            connection.off('delta', onDeltaInternal);
            connection.off('responseComplete', onCompleteInternal);
            connection.off('streamError', onErrorInternal);
        },
    };
}
