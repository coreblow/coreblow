// @ts-nocheck
/**
 * CoreBlow Gateway — WebSocket Connection Handler
 *
 * Manages WebSocket connections for real-time streaming, method
 * dispatch, client tracking, and heartbeat keepalive.
 *
 * Wave 3: Now uses CoreBlow-compatible protocol:
 *   Request:  { type: "req", id, method, params }
 *   Response: { type: "res", id, ok, payload, error }
 *   Event:    { type: "event", event, payload, seq }
 *
 * Implements the `connect` handshake method with schema validation
 * and timing-safe authentication via gateway-auth.
 */

import * as crypto from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { createChildLogger } from '../utils/logger.js';
import {
    PROTOCOL_VERSION,
    type ConnectParams,
    type HelloOk,
} from './protocol/index.js';
import {
    validateConnectParams,
    formatConnectValidationErrors,
} from './protocol/connect-schema.js';
import {
    authorizeGatewayConnect,
    isLocalDirectRequest,
    type ResolvedGatewayAuth,
} from './gateway-auth.js';

const log = createChildLogger('ws-handler');

// ─── Types ──────────────────────────────────────────────────────────

/** Connected WebSocket client */
export interface WsClient {
    id: string;
    connId: string;
    sessionId?: string;
    connectedAt: number;
    lastPingAt: number;
    authenticated: boolean;
    scopes: string[];
    role?: string;
    connect: ConnectParams;
    send: (data: string) => void;
    close: (code?: number, reason?: string) => void;
}

/** WebSocket method handler */
export type WsMethodHandler = (
    client: WsClient,
    params: Record<string, unknown>,
) => Promise<unknown>;

// ─── WsHandler ──────────────────────────────────────────────────────

/**
 * CoreBlow WebSocket Handler — CoreBlow-compatible protocol
 */
export class WsHandler {
    private clients = new Map<string, WsClient>();
    private methods = new Map<string, WsMethodHandler>();
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private resolvedAuth: ResolvedGatewayAuth | null = null;

    /**
     * Set the resolved auth config (called after server startup).
     */
    setAuth(auth: ResolvedGatewayAuth): void {
        this.resolvedAuth = auth;
    }

    /**
     * Register a method that clients can invoke via WebSocket messages.
     */
    registerMethod(name: string, handler: WsMethodHandler): void {
        this.methods.set(name, handler);
    }

    /**
     * Handle a new WebSocket connection.
     * Sends `connect.challenge` event to prompt the client to authenticate.
     */
    onConnect(
        ws: { send: (data: string) => void; close: (code?: number, reason?: string) => void },
        onMessage: (handler: (data: string) => void) => void,
        onClose: (handler: () => void) => void,
        req?: IncomingMessage,
    ): WsClient {
        const connId = `conn_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
        const nonce = crypto.randomBytes(32).toString('hex');

        const client: WsClient = {
            id: crypto.randomUUID(),
            connId,
            connectedAt: Date.now(),
            lastPingAt: Date.now(),
            authenticated: false,
            scopes: [],
            connect: {} as ConnectParams,
            send: (data) => {
                try { ws.send(data); } catch { /* ignore */ }
            },
            close: (code, reason) => {
                try { ws.close(code, reason); } catch { /* ignore */ }
            },
        };

        this.clients.set(client.id, client);

        // Store req reference for auth checks
        const clientReq = req;

        // Wire message handler
        onMessage((data) => {
            void this.handleMessage(client, data, clientReq);
        });

        // Wire close handler
        onClose(() => {
            this.clients.delete(client.id);
            log.debug({ connId: client.connId }, 'Client disconnected');
        });

        // Send connect challenge event (CoreBlow protocol)
        this.sendEvent(client, 'connect.challenge', { nonce });

        log.debug({ connId }, 'New WebSocket connection, challenge sent');

        return client;
    }

    // ─── Message Handling ────────────────────────────────────────────

    /**
     * Handle an incoming WebSocket message.
     *
     * CoreBlow protocol format:
     *   { type: "req", id: "uuid", method: "connect", params: { ... } }
     *
     * Legacy CoreBlow format (backward compat):
     *   { method: "ping", id: "123", params: {} }
     */
    private async handleMessage(
        client: WsClient,
        raw: string,
        req?: IncomingMessage,
    ): Promise<void> {
        let parsed: Record<string, unknown>;

        try {
            parsed = JSON.parse(raw);
        } catch {
            this.sendErrorResponse(client, null, 'PARSE_ERROR', 'Invalid JSON');
            return;
        }

        // Detect message format
        const isCoreBlowFormat = parsed.type === 'req';
        const method = (isCoreBlowFormat ? parsed.method : parsed.method) as string | undefined;
        const requestId = (parsed.id as string) ?? null;
        const params = ((isCoreBlowFormat ? parsed.params : parsed.params) ?? {}) as Record<string, unknown>;

        if (!method || typeof method !== 'string') {
            this.sendErrorResponse(client, requestId, 'INVALID_METHOD', 'Missing method name');
            return;
        }

        // Built-in: connect handshake
        if (method === 'connect') {
            this.handleConnect(client, requestId, params, req);
            return;
        }

        // Built-in: ping/pong
        if (method === 'ping') {
            client.lastPingAt = Date.now();
            this.sendOkResponse(client, requestId, { pong: true, timestamp: Date.now() });
            return;
        }

        // Require authentication for all other methods
        if (!client.authenticated) {
            this.sendErrorResponse(client, requestId, 'UNAUTHORIZED', 'Not authenticated — send connect first');
            return;
        }

        // Dispatch to registered method handler
        const handler = this.methods.get(method);
        if (!handler) {
            this.sendErrorResponse(client, requestId, 'UNKNOWN_METHOD', `Method "${method}" not found`);
            return;
        }

        try {
            const result = await handler(client, params);
            this.sendOkResponse(client, requestId, result);
        } catch (err) {
            this.sendErrorResponse(
                client,
                requestId,
                'HANDLER_ERROR',
                err instanceof Error ? err.message : 'Unknown error',
            );
        }
    }

    // ─── Connect Handshake ───────────────────────────────────────────

    /**
     * Handle the `connect` method — authenticate and establish session.
     *
     * CoreBlow protocol flow:
     * 1. Validate connect params (schema check)
     * 2. Authorize credentials (token/password/trusted-proxy)
     * 3. Respond with `hello-ok` payload
     */
    private handleConnect(
        client: WsClient,
        requestId: string | null,
        params: Record<string, unknown>,
        req?: IncomingMessage,
    ): void {
        // Step 1: Schema validation
        const validation = validateConnectParams(params);
        if (!validation.valid) {
            const errorMsg = `invalid connect params: ${formatConnectValidationErrors(validation.errors)}`;
            log.warn({ connId: client.connId, errors: validation.errors }, errorMsg);
            this.sendErrorResponse(client, requestId, 'INVALID_CONNECT', errorMsg);
            return;
        }

        const connectParams = params as unknown as ConnectParams;

        // Step 2: Authorize
        if (!this.resolvedAuth) {
            // No auth configured — accept all
            log.debug({ connId: client.connId }, 'No auth configured, auto-accepting connect');
        } else {
            const authResult = authorizeGatewayConnect({
                resolvedAuth: this.resolvedAuth,
                connectToken: connectParams.auth?.token ?? connectParams.auth?.bootstrapToken,
                connectPassword: connectParams.auth?.password,
                isLocalRequest: isLocalDirectRequest(req),
                req,
            });

            if (!authResult.ok) {
                log.warn(
                    { connId: client.connId, reason: authResult.reason },
                    `Connect auth failed: ${authResult.reason}`,
                );
                this.sendErrorResponse(client, requestId, 'UNAUTHORIZED', authResult.reason ?? 'Authentication failed');
                client.close(4001, 'Unauthorized');
                return;
            }

            log.info(
                { connId: client.connId, method: authResult.method },
                `Connect authorized via ${authResult.method}`,
            );
        }

        // Step 3: Accept connection
        client.authenticated = true;
        client.connect = connectParams;
        client.role = connectParams.role ?? 'operator';
        client.scopes = Array.isArray(connectParams.scopes) ? connectParams.scopes : [];

        // Build hello-ok response (CoreBlow protocol)
        const helloOk: HelloOk = {
            protocol: PROTOCOL_VERSION,
            sessionKey: client.connId,
            auth: {
                role: client.role,
                scopes: client.scopes,
            },
            policy: {
                tickIntervalMs: 30_000,
            },
        };

        this.sendOkResponse(client, requestId, { type: 'hello-ok', ...helloOk });

        log.info(
            {
                connId: client.connId,
                clientId: connectParams.client?.id,
                role: client.role,
                scopes: client.scopes.length,
            },
            'Client connected successfully',
        );
    }

    // ─── Response Helpers (CoreBlow-compatible) ──────────────────────

    /**
     * Send a success response: { type: "res", id, ok: true, payload }
     */
    private sendOkResponse(client: WsClient, requestId: string | null, payload: unknown): void {
        client.send(JSON.stringify({
            type: 'res',
            id: requestId,
            ok: true,
            payload: payload ?? {},
        }));
    }

    /**
     * Send an error response: { type: "res", id, ok: false, error: { code, message } }
     */
    private sendErrorResponse(
        client: WsClient,
        requestId: string | null,
        code: string,
        message: string,
    ): void {
        client.send(JSON.stringify({
            type: 'res',
            id: requestId,
            ok: false,
            error: { code, message },
        }));
    }

    /**
     * Send an event: { type: "event", event, payload, seq }
     */
    sendEvent(client: WsClient, event: string, payload: unknown, seq?: number): void {
        client.send(JSON.stringify({
            type: 'event',
            event,
            payload,
            ...(seq !== undefined ? { seq } : {}),
        }));
    }

    // ─── Broadcast & Lifecycle ───────────────────────────────────────

    /**
     * Broadcast an event to all connected (authenticated) clients.
     */
    broadcast(event: string, data: unknown, opts?: { requireAuth?: boolean }): void {
        const payload = JSON.stringify({
            type: 'event',
            event,
            payload: data,
        });
        for (const client of this.clients.values()) {
            if (opts?.requireAuth && !client.authenticated) continue;
            try {
                client.send(payload);
            } catch {
                // Client disconnected
            }
        }
    }

    /** Get the count of connected clients. */
    getClientCount(): number {
        return this.clients.size;
    }

    /** Get all connected client IDs. */
    getConnectedClients(): WsClient[] {
        return [...this.clients.values()];
    }

    /** Start periodic heartbeat checks to clean up stale connections. */
    startHeartbeat(intervalMs: number = 30_000, timeoutMs: number = 60_000): void {
        if (this.heartbeatInterval) return;

        this.heartbeatInterval = setInterval(() => {
            const cutoff = Date.now() - timeoutMs;
            for (const [id, client] of this.clients) {
                if (client.lastPingAt < cutoff) {
                    client.close(1001, 'Heartbeat timeout');
                    this.clients.delete(id);
                }
            }
        }, intervalMs);
    }

    /** Stop heartbeat checks. */
    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /** Disconnect all clients and clean up. */
    closeAll(reason: string = 'Server shutdown'): void {
        this.stopHeartbeat();
        for (const client of this.clients.values()) {
            client.close(1001, reason);
        }
        this.clients.clear();
    }
}
