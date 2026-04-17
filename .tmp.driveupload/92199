/**
 * CoreBlow Gateway — WebSocket Connection Handler
 *
 * Manages WebSocket connections for real-time streaming, method
 * dispatch, client tracking, and heartbeat keepalive.
 *
 * Inspired by CoreBlow's gateway/server-ws-runtime.ts but written
 * as a clean, self-contained WebSocket manager.
 */

import * as crypto from 'node:crypto';

/** Connected WebSocket client */
export interface WsClient {
    id: string;
    sessionId?: string;
    connectedAt: number;
    lastPingAt: number;
    authenticated: boolean;
    scopes: string[];
    send: (data: string) => void;
    close: (code?: number, reason?: string) => void;
}

/** WebSocket method handler */
export type WsMethodHandler = (
    client: WsClient,
    params: Record<string, unknown>,
) => Promise<unknown>;

/**
 * CoreBlow WebSocket Handler
 */
export class WsHandler {
    private clients = new Map<string, WsClient>();
    private methods = new Map<string, WsMethodHandler>();
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Register a method that clients can invoke via WebSocket messages.
     */
    registerMethod(name: string, handler: WsMethodHandler): void {
        this.methods.set(name, handler);
    }

    /**
     * Handle a new WebSocket connection.
     */
    onConnect(ws: { send: (data: string) => void; close: (code?: number, reason?: string) => void },
        onMessage: (handler: (data: string) => void) => void,
        onClose: (handler: () => void) => void,
    ): WsClient {
        const client: WsClient = {
            id: crypto.randomUUID(),
            connectedAt: Date.now(),
            lastPingAt: Date.now(),
            authenticated: false,
            scopes: [],
            send: (data) => ws.send(data),
            close: (code, reason) => ws.close(code, reason),
        };

        this.clients.set(client.id, client);

        // Wire message handler
        onMessage((data) => {
            void this.handleMessage(client, data);
        });

        // Wire close handler
        onClose(() => {
            this.clients.delete(client.id);
        });

        return client;
    }

    /**
     * Handle an incoming WebSocket message.
     * Expected format: { method: string, id?: string, params?: object }
     */
    private async handleMessage(client: WsClient, raw: string): Promise<void> {
        let parsed: { method?: string; id?: string; params?: Record<string, unknown> };

        try {
            parsed = JSON.parse(raw);
        } catch {
            this.sendError(client, null, 'PARSE_ERROR', 'Invalid JSON');
            return;
        }

        const method = parsed.method;
        const requestId = parsed.id ?? null;

        if (!method || typeof method !== 'string') {
            this.sendError(client, requestId, 'INVALID_METHOD', 'Missing method name');
            return;
        }

        // Handle ping/pong
        if (method === 'ping') {
            client.lastPingAt = Date.now();
            this.sendResult(client, requestId, { pong: true, timestamp: Date.now() });
            return;
        }

        const handler = this.methods.get(method);
        if (!handler) {
            this.sendError(client, requestId, 'UNKNOWN_METHOD', `Method "${method}" not found`);
            return;
        }

        try {
            const result = await handler(client, parsed.params ?? {});
            this.sendResult(client, requestId, result);
        } catch (err) {
            this.sendError(
                client,
                requestId,
                'HANDLER_ERROR',
                err instanceof Error ? err.message : 'Unknown error',
            );
        }
    }

    /**
     * Send a success response to a client.
     */
    private sendResult(client: WsClient, requestId: string | null, result: unknown): void {
        client.send(JSON.stringify({ id: requestId, result }));
    }

    /**
     * Send an error response to a client.
     */
    private sendError(client: WsClient, requestId: string | null, code: string, message: string): void {
        client.send(JSON.stringify({ id: requestId, error: { code, message } }));
    }

    /**
     * Broadcast a message to all connected (authenticated) clients.
     */
    broadcast(event: string, data: unknown, opts?: { requireAuth?: boolean }): void {
        const payload = JSON.stringify({ event, data });
        for (const client of Array.from(this.clients.values())) {
            if (opts?.requireAuth && !client.authenticated) continue;
            try {
                client.send(payload);
            } catch {
                // Client disconnected
            }
        }
    }

    /**
     * Get the count of connected clients.
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Start periodic heartbeat checks to clean up stale connections.
     */
    startHeartbeat(intervalMs: number = 30_000, timeoutMs: number = 60_000): void {
        if (this.heartbeatInterval) return;

        this.heartbeatInterval = setInterval(() => {
            const cutoff = Date.now() - timeoutMs;
            for (const [id, client] of Array.from(this.clients)) {
                if (client.lastPingAt < cutoff) {
                    client.close(1001, 'Heartbeat timeout');
                    this.clients.delete(id);
                }
            }
        }, intervalMs);
    }

    /**
     * Stop heartbeat checks.
     */
    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Disconnect all clients and clean up.
     */
    closeAll(reason: string = 'Server shutdown'): void {
        this.stopHeartbeat();
        for (const client of Array.from(this.clients.values())) {
            client.close(1001, reason);
        }
        this.clients.clear();
    }
}
