/**
 * CoreBlow — Chat Handler
 *
 * HTTP request handler that bridges incoming chat requests
 * to the AgentRuntime. Creates sessions, runs turns, and
 * returns structured JSON responses.
 *
 * Routes:
 *   POST /api/chat        — Send a message, get AI response
 *   POST /api/sessions    — Create a new session
 *   GET  /api/sessions    — List active sessions
 *   DELETE /api/sessions/:id — Destroy a session
 *
 * @packageDocumentation
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { AgentRuntime, type AgentSessionConfig } from '../agents/runtime.js';
import { GuardrailsEngine } from '../security/guardrails.js';

// ─── Types ───────────────────────────────────────────────────────

interface ChatRequest {
    message: string;
    sessionId?: string;
    model?: string;
    systemPrompt?: string;
}

interface ChatResponse {
    sessionId: string;
    text: string;
    usage?: { input: number; output: number; total: number };
    model: string;
    durationMs: number;
}

interface SessionInfo {
    id: string;
    state: string;
    messageCount: number;
    tokenUsage: { input: number; output: number; total: number };
}

// ─── Helper: Read JSON Body ─────────────────────────────────────

async function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

function jsonResponse(res: ServerResponse, statusCode: number, data: unknown): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}

// ─── Chat Handler ───────────────────────────────────────────────

let sessionCounter = 0;

export class ChatHandler {
    private runtime: AgentRuntime;
    private guardrails: GuardrailsEngine;
    private defaultModel: string;
    private defaultProvider: string;

    constructor(runtime: AgentRuntime, opts?: { defaultModel?: string; defaultProvider?: string }) {
        this.runtime = runtime;
        this.guardrails = new GuardrailsEngine();
        this.defaultModel = opts?.defaultModel ?? 'gpt-4o';
        this.defaultProvider = opts?.defaultProvider ?? 'openai';
    }

    /**
     * Route an incoming HTTP request to the appropriate handler.
     * Returns true if handled, false if not matched.
     */
    async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const method = (req.method ?? 'GET').toUpperCase();
        const path = url.pathname;

        // CORS headers for browser access
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return true;
        }

        try {
            // POST /api/chat — send message
            if (method === 'POST' && path === '/api/chat') {
                await this.handleChat(req, res);
                return true;
            }

            // POST /api/sessions — create session
            if (method === 'POST' && path === '/api/sessions') {
                await this.handleCreateSession(req, res);
                return true;
            }

            // GET /api/sessions — list sessions
            if (method === 'GET' && path === '/api/sessions') {
                this.handleListSessions(res);
                return true;
            }

            // DELETE /api/sessions/:id
            if (method === 'DELETE' && path.startsWith('/api/sessions/')) {
                const sessionId = path.slice('/api/sessions/'.length);
                this.handleDeleteSession(res, sessionId);
                return true;
            }

            return false;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            jsonResponse(res, 500, { error: 'Internal Server Error', message });
            return true;
        }
    }

    // ─── POST /api/chat ─────────────────────────────────────────

    private async handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await readBody(req);
        let data: ChatRequest;

        try {
            data = JSON.parse(body) as ChatRequest;
        } catch {
            jsonResponse(res, 400, { error: 'Invalid JSON body' });
            return;
        }

        if (!data.message || typeof data.message !== 'string') {
            jsonResponse(res, 400, { error: 'Missing required field: message' });
            return;
        }

        // Guardrails scan
        const scan = this.guardrails.scan(data.message);
        if (scan.blocked) {
            jsonResponse(res, 422, {
                error: 'Message blocked by safety policy',
                categories: scan.enforcements,
            });
            return;
        }

        // Get or create session
        let sessionId = data.sessionId;
        if (!sessionId || !this.runtime.getSession(sessionId)) {
            sessionId = `ses_${Date.now()}_${++sessionCounter}`;
            const config: AgentSessionConfig = {
                model: data.model ?? this.defaultModel,
                provider: this.defaultProvider,
                systemPrompt: data.systemPrompt ?? 'You are CoreBlow, a helpful AI assistant.',
                maxContextTokens: 128_000,
                maxOutputTokens: 4_096,
                temperature: 0.7,
            };
            this.runtime.createSession(sessionId, config);
        }

        const session = this.runtime.getSession(sessionId);
        if (!session) {
            jsonResponse(res, 500, { error: 'Failed to create session' });
            return;
        }

        // Run turn
        const startMs = Date.now();
        try {
            const responseText = await session.chat(data.message);
            const usage = session.getTokenUsage();
            const durationMs = Date.now() - startMs;

            const response: ChatResponse = {
                sessionId,
                text: responseText,
                usage: { input: usage.input, output: usage.output, total: usage.total },
                model: data.model ?? this.defaultModel,
                durationMs,
            };

            jsonResponse(res, 200, response);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            jsonResponse(res, 502, {
                error: 'AI provider error',
                message,
                sessionId,
            });
        }
    }

    // ─── POST /api/sessions ─────────────────────────────────────

    private async handleCreateSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
        const body = await readBody(req);
        let data: Partial<AgentSessionConfig> = {};
        try {
            data = JSON.parse(body) as Partial<AgentSessionConfig>;
        } catch {
            // Use defaults
        }

        const sessionId = `ses_${Date.now()}_${++sessionCounter}`;
        const config: AgentSessionConfig = {
            model: data.model ?? this.defaultModel,
            provider: data.provider ?? this.defaultProvider,
            systemPrompt: data.systemPrompt ?? 'You are CoreBlow, a helpful AI assistant.',
            maxContextTokens: 128_000,
            maxOutputTokens: 4_096,
            temperature: data.temperature ?? 0.7,
        };

        this.runtime.createSession(sessionId, config);
        jsonResponse(res, 201, { sessionId, model: config.model, provider: config.provider });
    }

    // ─── GET /api/sessions ──────────────────────────────────────

    private handleListSessions(res: ServerResponse): void {
        const sessions: SessionInfo[] = this.runtime.listSessions();
        jsonResponse(res, 200, { sessions });
    }

    // ─── DELETE /api/sessions/:id ───────────────────────────────

    private handleDeleteSession(res: ServerResponse, sessionId: string): void {
        const destroyed = this.runtime.destroySession(sessionId);
        if (destroyed) {
            jsonResponse(res, 200, { ok: true, sessionId });
        } else {
            jsonResponse(res, 404, { error: `Session "${sessionId}" not found` });
        }
    }
}
