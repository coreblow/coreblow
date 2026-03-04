/**
 * src/gateway/protocol.ts
 * WebSocket wire protocol — connect, req/res, events, typing
 */

import type { WebSocket } from 'ws';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('protocol');

// --- Message Types ---

export type WsMessageType =
    | 'connect'
    | 'connected'
    | 'message'
    | 'response'
    | 'response.chunk'
    | 'response.done'
    | 'typing'
    | 'error'
    | 'event'
    | 'ping'
    | 'pong';

export interface WsMessage {
    type: WsMessageType;
    id?: string;
    data?: any;
    timestamp?: string;
}

export interface WsClient {
    id: string;
    ws: WebSocket;
    authenticated: boolean;
    connectedAt: number;
    metadata: Record<string, any>;
}

// --- Protocol Handler ---

export class ProtocolHandler {
    private clients: Map<string, WsClient> = new Map();
    private messageHandlers: Map<string, (client: WsClient, msg: WsMessage) => void> = new Map();

    constructor() {
        // Register built-in handlers
        this.on('ping', (client) => {
            this.send(client, { type: 'pong', timestamp: new Date().toISOString() });
        });
    }

    /**
     * Register a message type handler
     */
    on(type: string, handler: (client: WsClient, msg: WsMessage) => void) {
        this.messageHandlers.set(type, handler);
    }

    /**
     * Handle new WebSocket connection
     */
    handleConnection(ws: WebSocket, clientId: string) {
        const client: WsClient = {
            id: clientId,
            ws,
            authenticated: false,
            connectedAt: Date.now(),
            metadata: {},
        };

        this.clients.set(clientId, client);
        log.info({ clientId }, 'Client connected');

        // Send connected acknowledgement
        this.send(client, {
            type: 'connected',
            id: clientId,
            data: { message: 'Connected to CoreBlow Gateway' },
            timestamp: new Date().toISOString(),
        });

        // Handle incoming messages
        ws.on('message', (raw) => {
            try {
                const msg: WsMessage = JSON.parse(raw.toString());
                this.handleMessage(client, msg);
            } catch (err) {
                this.send(client, {
                    type: 'error',
                    data: { message: 'Invalid JSON message' },
                });
            }
        });

        ws.on('close', () => {
            this.clients.delete(clientId);
            log.info({ clientId }, 'Client disconnected');
        });

        ws.on('error', (err) => {
            log.error({ clientId, err: err.message }, 'WebSocket error');
            this.clients.delete(clientId);
        });
    }

    /**
     * Route message to registered handler
     */
    private handleMessage(client: WsClient, msg: WsMessage) {
        const handler = this.messageHandlers.get(msg.type);
        if (handler) {
            handler(client, msg);
        } else {
            log.warn({ type: msg.type, clientId: client.id }, 'Unknown message type');
            this.send(client, {
                type: 'error',
                data: { message: `Unknown message type: ${msg.type}` },
            });
        }
    }

    /**
     * Send message to a client
     */
    send(client: WsClient, msg: WsMessage) {
        if (client.ws.readyState === client.ws.OPEN) {
            client.ws.send(JSON.stringify({
                ...msg,
                timestamp: msg.timestamp || new Date().toISOString(),
            }));
        }
    }

    /**
     * Broadcast to all connected clients
     */
    broadcast(msg: WsMessage, filter?: (client: WsClient) => boolean) {
        for (const client of this.clients.values()) {
            if (!filter || filter(client)) {
                this.send(client, msg);
            }
        }
    }

    /**
     * Send streaming response chunks
     */
    sendStreamChunk(client: WsClient, requestId: string, chunk: string) {
        this.send(client, {
            type: 'response.chunk',
            id: requestId,
            data: { content: chunk },
        });
    }

    /**
     * Signal stream completion
     */
    sendStreamDone(client: WsClient, requestId: string, metadata?: any) {
        this.send(client, {
            type: 'response.done',
            id: requestId,
            data: metadata || {},
        });
    }

    /**
     * Send typing indicator
     */
    sendTyping(client: WsClient, isTyping: boolean) {
        this.send(client, {
            type: 'typing',
            data: { typing: isTyping },
        });
    }

    getClient(id: string): WsClient | undefined {
        return this.clients.get(id);
    }

    getClientCount(): number {
        return this.clients.size;
    }

    getConnectedClients(): WsClient[] {
        return Array.from(this.clients.values());
    }
}
