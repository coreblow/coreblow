/**
 * CoreBlow — Gateway Entry
 *
 * Boots the CoreBlow Gateway server with fully wired HTTP endpoints.
 * This is the "last-mile" integration layer that connects:
 * - GatewayServer (service registry + bootstrapper)
 * - Health probe endpoints (liveness + readiness)
 * - Chat API (/api/chat, /api/sessions)
 * - Webhook channel (/webhook/:id, /api/webhooks)
 * - WebChat dashboard (/)
 * - CLI Banner (colorful startup display)
 * - Graceful shutdown (SIGINT/SIGTERM)
 *
 * Follows OpenClaw's server-http.ts pattern where health routes
 * are wired inline into the HTTP server request handler.
 *
 * @packageDocumentation
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { CoreBlowServer } from './gateway/server.js';
import { checkHealth, checkLiveness, checkReadiness } from './gateway/health-check.js';
import { CLIBanner } from './cli/cli-banner.js';
import { VERSION } from './version.js';
import { loadConfig } from './config/config.js';
import { resolveStartupModelRef } from './gateway/server-startup-log.js';
import { bootstrapRuntime, resolveModelFromConfig, resolveApiKey } from './gateway/provider-bootstrap.js';
import { ChatHandler } from './gateway/chat-handler.js';
import { ChannelBridge, type InboundMessage } from './gateway/channel-bridge.js';
import { WebhookAdapter, type WebhookInboundMessage } from './channels/webhook-adapter.js';
import { createChannelManager, type ChannelManager } from './gateway/channel-manager.js';
import type { ChannelMessage } from './channels/adapter.js';
import { SSEHandler } from './gateway/sse-handler.js';
import { WsHandler } from './gateway/ws-handler.js';
import { SessionManager } from './gateway/session-manager.js';

// ─── Constants ────────────────────────────────────────────────────

/** Health probe status paths — matching OpenClaw convention */
const PROBE_PATHS = new Map<string, 'live' | 'ready'>([
    ['/health', 'live'],
    ['/healthz', 'live'],
    ['/api/health', 'live'],
    ['/ready', 'ready'],
    ['/readyz', 'ready'],
]);

// ─── ANSI Color Helpers ──────────────────────────────────────────

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
    orange: '\x1b[38;5;173m',
};

// ─── Gateway Options ─────────────────────────────────────────────

export interface GatewayStartOptions {
    port?: number;
    host?: string;
    allowUnconfigured?: boolean;
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

// ─── Health Request Handler ──────────────────────────────────────

/**
 * Handle health probe HTTP requests.
 * Returns true if the request was handled, false if it should pass through.
 */
async function handleProbeRequest(
    req: IncomingMessage,
    res: ServerResponse,
): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const probeType = PROBE_PATHS.get(url.pathname);

    if (!probeType) return false;

    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, HEAD');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Method Not Allowed');
        return true;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');

    let statusCode: number;
    let body: Record<string, unknown>;

    if (probeType === 'ready') {
        const readiness = await checkReadiness();
        statusCode = readiness.ready ? 200 : 503;
        body = readiness;
    } else {
        // Liveness — always shallow, fast
        const liveness = await checkLiveness();
        statusCode = 200;
        body = { ok: liveness.alive, status: 'live', version: VERSION };
    }

    res.statusCode = statusCode;
    if (method === 'HEAD') {
        res.end();
    } else {
        res.end(JSON.stringify(body));
    }
    return true;
}

// ─── WebChat Dashboard HTML ─────────────────────────────────────

function getDashboardHTML(port: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoreBlow — AI Agent OS</title>
    <meta name="description" content="CoreBlow Enterprise-Grade AI Agent OS — WebChat Dashboard">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --cb-orange: #DA7756;
            --cb-orange-light: #E8956F;
            --cb-orange-dark: #C46244;
            --cb-bg-primary: #0F1117;
            --cb-bg-secondary: #161822;
            --cb-bg-tertiary: #1C1F2E;
            --cb-bg-hover: #252838;
            --cb-text-primary: #E8EAF0;
            --cb-text-secondary: #9DA3B4;
            --cb-text-dim: #5A6178;
            --cb-border: #2A2D3E;
            --cb-success: #4ADE80;
            --cb-error: #F87171;
            --cb-user-bg: #1B2A4A;
            --cb-radius: 12px;
            --cb-shadow: 0 4px 24px rgba(0,0,0,0.3);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--cb-bg-primary);
            color: var(--cb-text-primary);
            height: 100vh; display: flex; flex-direction: column;
            overflow: hidden;
        }
        /* ─── Header ─── */
        .header {
            background: var(--cb-bg-secondary);
            border-bottom: 1px solid var(--cb-border);
            padding: 14px 24px;
            display: flex; align-items: center; gap: 14px;
            backdrop-filter: blur(12px);
        }
        .logo { font-size: 28px; }
        .brand {
            font-size: 18px; font-weight: 700;
            background: linear-gradient(135deg, var(--cb-orange), var(--cb-orange-light));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .header-meta {
            margin-left: auto; display: flex; gap: 16px;
            font-size: 12px; color: var(--cb-text-dim);
        }
        .status-dot {
            width: 8px; height: 8px; border-radius: 50%;
            display: inline-block; margin-right: 4px;
            animation: pulse 2s ease-in-out infinite;
        }
        .status-dot.online { background: var(--cb-success); }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
        /* ─── Chat Area ─── */
        .chat-area {
            flex: 1; overflow-y: auto; padding: 24px;
            display: flex; flex-direction: column; gap: 16px;
            scroll-behavior: smooth;
        }
        .chat-area::-webkit-scrollbar { width: 6px; }
        .chat-area::-webkit-scrollbar-track { background: transparent; }
        .chat-area::-webkit-scrollbar-thumb {
            background: var(--cb-border); border-radius: 3px;
        }
        .message {
            max-width: 75%; padding: 14px 18px; border-radius: var(--cb-radius);
            font-size: 14px; line-height: 1.65; word-wrap: break-word;
            animation: msgIn 0.3s ease-out;
        }
        @keyframes msgIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .message.user {
            align-self: flex-end;
            background: var(--cb-user-bg);
            border: 1px solid rgba(59,130,246,0.2);
            color: var(--cb-text-primary);
        }
        .message.assistant {
            align-self: flex-start;
            background: var(--cb-bg-tertiary);
            border: 1px solid var(--cb-border);
        }
        .message.system {
            align-self: center; text-align: center;
            background: transparent; color: var(--cb-text-dim);
            font-size: 12px; padding: 8px;
        }
        .message-meta {
            font-size: 11px; color: var(--cb-text-dim);
            margin-top: 6px;
        }
        .typing {
            align-self: flex-start; padding: 12px 18px;
            background: var(--cb-bg-tertiary); border: 1px solid var(--cb-border);
            border-radius: var(--cb-radius); display: none; gap: 4px; align-items: center;
        }
        .typing.active { display: flex; }
        .typing span {
            width: 6px; height: 6px; border-radius: 50%;
            background: var(--cb-text-dim); animation: typingDot 1.4s infinite;
        }
        .typing span:nth-child(2) { animation-delay: 0.2s; }
        .typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingDot {
            0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
            30% { opacity: 1; transform: scale(1); }
        }
        /* ─── Input Area ─── */
        .input-area {
            background: var(--cb-bg-secondary);
            border-top: 1px solid var(--cb-border);
            padding: 16px 24px;
        }
        .input-wrapper {
            display: flex; gap: 10px; max-width: 900px; margin: 0 auto;
        }
        #chatInput {
            flex: 1; padding: 12px 16px;
            background: var(--cb-bg-tertiary); color: var(--cb-text-primary);
            border: 1px solid var(--cb-border); border-radius: var(--cb-radius);
            font-family: 'Inter', sans-serif; font-size: 14px; outline: none;
            transition: border-color 0.2s;
        }
        #chatInput:focus { border-color: var(--cb-orange); }
        #chatInput::placeholder { color: var(--cb-text-dim); }
        #sendBtn {
            padding: 12px 20px; border: none; border-radius: var(--cb-radius);
            background: linear-gradient(135deg, var(--cb-orange), var(--cb-orange-light));
            color: white; font-weight: 600; font-size: 14px; cursor: pointer;
            transition: all 0.2s; font-family: 'Inter', sans-serif;
        }
        #sendBtn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(218,119,86,0.3); }
        #sendBtn:active { transform: translateY(0); }
        #sendBtn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .footer-meta {
            text-align: center; font-size: 11px; color: var(--cb-text-dim);
            margin-top: 8px;
        }
        /* ─── Welcome ─── */
        .welcome {
            text-align: center; padding: 48px 24px; flex: 1;
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 12px;
        }
        .welcome-logo { font-size: 72px; margin-bottom: 8px; }
        .welcome h1 {
            font-size: 28px; font-weight: 700;
            background: linear-gradient(135deg, var(--cb-orange), var(--cb-orange-light));
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .welcome p { color: var(--cb-text-secondary); font-size: 15px; max-width: 480px; }
        .shortcuts { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
        .shortcut {
            padding: 8px 16px; border-radius: 20px;
            background: var(--cb-bg-tertiary); border: 1px solid var(--cb-border);
            color: var(--cb-text-secondary); font-size: 13px; cursor: pointer;
            transition: all 0.2s;
        }
        .shortcut:hover {
            border-color: var(--cb-orange); color: var(--cb-orange);
            background: rgba(218,119,86,0.08);
        }
        /* ─── Code blocks ─── */
        .message pre {
            background: var(--cb-bg-primary); padding: 12px;
            border-radius: 8px; overflow-x: auto; margin: 8px 0;
            font-family: 'JetBrains Mono', monospace; font-size: 13px;
        }
        .message code {
            font-family: 'JetBrains Mono', monospace; font-size: 13px;
            background: var(--cb-bg-primary); padding: 2px 6px; border-radius: 4px;
        }
        .message pre code { background: none; padding: 0; }
    </style>
</head>
<body>
    <header class="header">
        <span class="logo">🐙</span>
        <span class="brand">CoreBlow</span>
        <div class="header-meta">
            <span><span class="status-dot online"></span>Online</span>
            <span id="modelName">Loading...</span>
            <span id="tokenCount"></span>
        </div>
    </header>

    <div class="chat-area" id="chatArea">
        <div class="welcome" id="welcome">
            <div class="welcome-logo">🐙</div>
            <h1>CoreBlow AI Agent OS</h1>
            <p>Enterprise-grade AI agent orchestration. Ask me anything to get started.</p>
            <div class="shortcuts">
                <div class="shortcut" onclick="sendQuick('What can you do?')">💡 What can you do?</div>
                <div class="shortcut" onclick="sendQuick('Tell me about CoreBlow')">🐙 About CoreBlow</div>
                <div class="shortcut" onclick="sendQuick('Write a hello world in Python')">🐍 Hello World</div>
            </div>
        </div>
        <div class="typing" id="typing"><span></span><span></span><span></span></div>
    </div>

    <div class="input-area">
        <div class="input-wrapper">
            <input type="text" id="chatInput" placeholder="Type your message..."
                   autocomplete="off" autofocus>
            <button id="sendBtn" onclick="sendMessage()">Send</button>
        </div>
        <div class="footer-meta">
            CoreBlow v${VERSION} • <span id="sessionInfo">Initializing...</span>
        </div>
    </div>

    <script>
        const BASE = '';
        let sessionId = null;
        let totalTokens = 0;

        // Initialize session
        async function init() {
            try {
                const res = await fetch(BASE + '/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                sessionId = data.sessionId;
                document.getElementById('modelName').textContent = data.model || 'default';
                document.getElementById('sessionInfo').textContent = 'Session: ' + sessionId.slice(0, 16) + '...';
            } catch (err) {
                document.getElementById('sessionInfo').textContent = 'Connection error';
            }
        }

        // Send message
        async function sendMessage() {
            const input = document.getElementById('chatInput');
            const text = input.value.trim();
            if (!text) return;

            // Hide welcome
            const welcome = document.getElementById('welcome');
            if (welcome) welcome.style.display = 'none';

            // Add user message
            addMessage(text, 'user');
            input.value = '';
            input.focus();

            // Show typing
            const typing = document.getElementById('typing');
            typing.classList.add('active');

            // Disable send
            const btn = document.getElementById('sendBtn');
            btn.disabled = true;

            try {
                const res = await fetch(BASE + '/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, sessionId }),
                });
                const data = await res.json();

                typing.classList.remove('active');

                if (data.error) {
                    addMessage('⚠️ ' + data.error + (data.message ? ': ' + data.message : ''), 'system');
                } else {
                    addMessage(data.text, 'assistant', data.usage, data.durationMs);
                    if (data.usage) {
                        totalTokens += data.usage.total;
                        document.getElementById('tokenCount').textContent = totalTokens.toLocaleString() + ' tokens';
                    }
                }
            } catch (err) {
                typing.classList.remove('active');
                addMessage('❌ Connection error: ' + err.message, 'system');
            }

            btn.disabled = false;
        }

        // Quick send
        function sendQuick(text) {
            document.getElementById('chatInput').value = text;
            sendMessage();
        }

        // Add message to chat
        function addMessage(text, role, usage, durationMs) {
            const area = document.getElementById('chatArea');
            const msg = document.createElement('div');
            msg.className = 'message ' + role;

            // Simple markdown rendering
            let html = escapeHtml(text);
            // Code blocks
            html = html.replace(/\`\`\`(\\w*)?\\n([\\s\\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>');
            html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
            // Bold
            html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
            // Line breaks
            html = html.replace(/\\n/g, '<br>');

            msg.innerHTML = html;

            if (usage && role === 'assistant') {
                const meta = document.createElement('div');
                meta.className = 'message-meta';
                meta.textContent = usage.total + ' tokens • ' + durationMs + 'ms';
                msg.appendChild(meta);
            }

            // Insert before typing indicator
            const typing = document.getElementById('typing');
            area.insertBefore(msg, typing);
            area.scrollTop = area.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Enter to send
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        init();
    </script>
</body>
</html>`;
}

// ─── Main Start Function ─────────────────────────────────────────

/**
 * Start the CoreBlow Gateway.
 *
 * This is the production entry point called by the CLI `gateway` subcommand.
 * It creates an HTTP server with wired health probes, boots the CoreBlowServer
 * service registry, prints the startup banner, and installs graceful shutdown.
 */
export async function startGateway(opts?: GatewayStartOptions): Promise<void> {
    const port = opts?.port ?? 3000;
    const host = opts?.host ?? '0.0.0.0';

    // ── Step 1: Bootstrap Agent Runtime ───────────────────────
    const { runtime, provider, model, configured } = bootstrapRuntime();

    // ── Step 2: Create Handlers ──────────────────────────────
    const chatHandler = new ChatHandler(runtime, {
        defaultModel: model,
        defaultProvider: provider,
    });

    const channelBridge = new ChannelBridge(runtime, {
        defaultModel: model,
        defaultProvider: provider,
    });

    const webhookAdapter = new WebhookAdapter();

    // Wire webhook → channel bridge
    webhookAdapter.onMessage(async (msg: WebhookInboundMessage) => {
        const inbound: InboundMessage = {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            channelId: msg.channelId,
            channelType: 'webhook',
            text: msg.text,
            timestamp: msg.timestamp,
            metadata: msg.metadata,
        };
        const response = await channelBridge.handleInbound(inbound);

        // Try to send outbound
        await webhookAdapter.sendOutbound(msg.channelId, {
            channelId: msg.channelId,
            text: response.text,
        });
    });

    // ── Step 2b: Create Channel Manager ──────────────────────
    const channelMgr: ChannelManager = createChannelManager({
        loadConfig,
        onInbound: (msg: ChannelMessage) => {
            // Route inbound messages from all channels → ChannelBridge
            const inbound: InboundMessage = {
                id: msg.id,
                senderId: msg.senderId,
                senderName: msg.senderName,
                channelId: msg.chatId,
                channelType: msg.channel,
                text: msg.text,
                timestamp: msg.timestamp,
            };
            void channelBridge.handleInbound(inbound);
        },
        log: {
            info: (m: string) => console.log(`  ${c.dim}[channels]${c.reset} ${m}`),
            warn: (m: string) => console.log(`  ${c.yellow}[channels]${c.reset} ${m}`),
            error: (m: string) => console.error(`  ${c.red}[channels]${c.reset} ${m}`),
        },
    });

    // ── Step 2c: Create SSE + WS Handlers ────────────────────
    const sseHandler = new SSEHandler();
    const wsHandler = new WsHandler();
    const sessionMgr = new SessionManager();

    // Register WS methods for channel bridge
    wsHandler.registerMethod('chat', async (_client, params) => {
        const text = (params.text ?? params.message) as string;
        if (!text) return { error: 'missing text' };
        const senderId = _client.sessionId ?? _client.id;
        const inbound: InboundMessage = {
            id: `ws-${Date.now()}`,
            senderId,
            channelId: 'webchat',
            channelType: 'websocket',
            text,
            timestamp: Date.now(),
        };
        const response = await channelBridge.handleInbound(inbound);
        return { text: response.text };
    });

    wsHandler.registerMethod('status', async () => ({
        version: VERSION,
        provider,
        model,
        uptime: process.uptime(),
        clients: wsHandler.getClientCount(),
        sse: sseHandler.getStats(),
    }));

    wsHandler.startHeartbeat();

    // ── Step 3: Dashboard HTML ───────────────────────────────
    const dashboardHTML = getDashboardHTML(port);

    // ── Step 4: Create HTTP Server ───────────────────────────
    const httpServer: Server = createServer((req, res) => {
        void handleRequest(req, res);
    });

    async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // Security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '0');

        try {
            // Health probes — always available, no auth required
            if (await handleProbeRequest(req, res)) return;

            // Chat API routes (/api/chat, /api/sessions)
            if (await chatHandler.handle(req, res)) return;

            const url = new URL(req.url ?? '/', 'http://localhost');
            const method = (req.method ?? 'GET').toUpperCase();
            const pathname = url.pathname;

            // CORS for all API routes
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (method === 'OPTIONS') {
                res.statusCode = 204;
                res.end();
                return;
            }

            // ─── Webhook Routes ──────────────────────────────

            // POST /api/webhooks — register webhook
            if (method === 'POST' && pathname === '/api/webhooks') {
                const body = JSON.parse(await readBody(req)) as {
                    id: string; name: string; outboundUrl: string; secret?: string;
                };
                webhookAdapter.register({
                    id: body.id,
                    name: body.name,
                    outboundUrl: body.outboundUrl,
                    secret: body.secret,
                });
                jsonResponse(res, 201, { ok: true, webhook: body });
                return;
            }

            // GET /api/webhooks — list webhooks
            if (method === 'GET' && pathname === '/api/webhooks') {
                jsonResponse(res, 200, { webhooks: webhookAdapter.list() });
                return;
            }

            // DELETE /api/webhooks/:id
            if (method === 'DELETE' && pathname.startsWith('/api/webhooks/')) {
                const id = pathname.slice('/api/webhooks/'.length);
                const deleted = webhookAdapter.unregister(id);
                jsonResponse(res, deleted ? 200 : 404, {
                    ok: deleted, id,
                });
                return;
            }

            // POST /webhook/:id — inbound webhook message
            if (method === 'POST' && pathname.startsWith('/webhook/')) {
                const webhookId = pathname.slice('/webhook/'.length);
                const body = await readBody(req);
                const signature = req.headers['x-webhook-signature'] as string | undefined;

                try {
                    const payload = JSON.parse(body) as unknown;
                    const msg = await webhookAdapter.processInbound(webhookId, payload, signature);
                    if (msg) {
                        jsonResponse(res, 200, { ok: true, messageId: msg.id });
                    } else {
                        jsonResponse(res, 404, { error: `Webhook "${webhookId}" not found` });
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    jsonResponse(res, 400, { error: message });
                }
                return;
            }

            // ─── Gateway Status API ──────────────────────────

            // GET /api/status — gateway status
            if (method === 'GET' && pathname === '/api/status') {
                jsonResponse(res, 200, {
                    version: VERSION,
                    provider,
                    model,
                    configured,
                    uptime: process.uptime(),
                    sessions: runtime.listSessions(),
                    channels: channelBridge.getStats(),
                    channelStates: channelMgr.getSnapshot(),
                    webhooks: webhookAdapter.list(),
                    sse: sseHandler.getStats(),
                    websocket: { clients: wsHandler.getClientCount() },
                    sessionCount: sessionMgr.count(),
                });
                return;
            }

            // GET /api/channels — per-channel lifecycle status
            if (method === 'GET' && pathname === '/api/channels') {
                jsonResponse(res, 200, {
                    channels: channelMgr.getSnapshot(),
                });
                return;
            }

            // POST /api/channels/:id/start — start a channel
            if (method === 'POST' && pathname.startsWith('/api/channels/') && pathname.endsWith('/start')) {
                const parts = pathname.split('/');
                const channelId = parts[3];
                if (channelId) {
                    await channelMgr.start(channelId as import('./channels/adapter.js').ChannelId);
                    jsonResponse(res, 200, { ok: true, channel: channelMgr.getState(channelId as import('./channels/adapter.js').ChannelId) });
                } else {
                    jsonResponse(res, 400, { error: 'missing channel ID' });
                }
                return;
            }

            // POST /api/channels/:id/stop — stop a channel
            if (method === 'POST' && pathname.startsWith('/api/channels/') && pathname.endsWith('/stop')) {
                const parts = pathname.split('/');
                const channelId = parts[3];
                if (channelId) {
                    await channelMgr.stop(channelId as import('./channels/adapter.js').ChannelId);
                    jsonResponse(res, 200, { ok: true, channel: channelMgr.getState(channelId as import('./channels/adapter.js').ChannelId) });
                } else {
                    jsonResponse(res, 400, { error: 'missing channel ID' });
                }
                return;
            }

            // ─── SSE Streaming ───────────────────────────────

            // GET /api/events — SSE stream
            if (method === 'GET' && pathname === '/api/events') {
                const channel = url.searchParams.get('channel') ?? 'default';
                const userId = url.searchParams.get('userId') ?? undefined;

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });

                const client = sseHandler.subscribe(channel, userId);

                // Send initial connection event
                res.write(sseHandler.formatEvent({
                    event: 'connected',
                    data: { clientId: client.id, channel },
                }));

                // Keepalive every 15s
                const keepalive = setInterval(() => {
                    try {
                        res.write(': keepalive\n\n');
                    } catch {
                        clearInterval(keepalive);
                    }
                }, 15_000);

                req.on('close', () => {
                    clearInterval(keepalive);
                    sseHandler.unsubscribe(client.id);
                });

                return;
            }

            // GET /api/events/stats — SSE statistics
            if (method === 'GET' && pathname === '/api/events/stats') {
                jsonResponse(res, 200, {
                    ...sseHandler.getStats(),
                    channels: sseHandler.listChannels(),
                });
                return;
            }

            // POST /api/events/broadcast — broadcast SSE event
            if (method === 'POST' && pathname === '/api/events/broadcast') {
                const body = JSON.parse(await readBody(req)) as {
                    channel: string; event?: string; data: unknown;
                };
                const sent = sseHandler.broadcast(body.channel, {
                    event: body.event,
                    data: body.data,
                });
                jsonResponse(res, 200, { ok: true, sent });
                return;
            }

            // ─── Session Management API ──────────────────────

            // GET /api/sessions — list sessions
            if (method === 'GET' && pathname === '/api/sessions') {
                jsonResponse(res, 200, {
                    sessions: sessionMgr.listSessions(),
                    count: sessionMgr.count(),
                });
                return;
            }

            // DELETE /api/sessions/:id — delete session
            if (method === 'DELETE' && pathname.startsWith('/api/sessions/')) {
                const sessionId = pathname.slice('/api/sessions/'.length);
                const deleted = sessionMgr.deleteSession(sessionId);
                jsonResponse(res, deleted ? 200 : 404, {
                    ok: deleted, id: sessionId,
                });
                return;
            }

            // ─── Dashboard ───────────────────────────────────

            // GET / — serve WebChat dashboard
            if (method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(dashboardHTML);
                return;
            }

            // Default 404
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Not Found', path: req.url }));
        } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
    }

    // ── Step 5: Boot CoreBlowServer (service registry) ────────
    const server = new CoreBlowServer({ port, host });

    try {
        const result = await server.start();
        if (!result.success) {
            console.error(`${c.red}✗ CoreBlow Gateway boot failed${c.reset}`);
            process.exit(1);
        }
    } catch {
        // Non-fatal: CoreBlowServer boot may fail if external deps are missing,
        // but we still want the HTTP server to come up for healthchecks.
    }

    // ── Step 6: Listen ────────────────────────────────────────
    await new Promise<void>((resolve, reject) => {
        httpServer.once('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                console.error(
                    `${c.red}✗ Port ${port} is already in use.${c.reset}\n` +
                    `  Another CoreBlow instance may be running.\n` +
                    `  Use --port <port> to pick a different port.`
                );
                process.exit(1);
            }
            reject(err);
        });
        httpServer.listen(port, host, () => resolve());
    });

    // ── Step 6b: Start all configured channels ───────────────
    try {
        await channelMgr.startAll();
    } catch (err) {
        console.error(`  ${c.yellow}⚠${c.reset} Channel startup error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Step 7: Print Startup Banner ──────────────────────────
    // Load config and resolve model ref (OpenClaw parity)
    const cfg = loadConfig();
    const startupRef = resolveStartupModelRef(cfg);

    const banner = CLIBanner.generate({
        version: VERSION,
        port,
        provider: startupRef.provider,
        model: startupRef.model,
    });
    console.log(banner);

    // Structured startup log (for Docker logs / monitoring)
    const endpoints: string[] = [];
    if (host === '0.0.0.0') {
        endpoints.push(`http://127.0.0.1:${port}`);
        endpoints.push(`http://0.0.0.0:${port}`);
    } else {
        endpoints.push(`http://${host}:${port}`);
    }

    const configStatus = configured
        ? `${c.green}✓${c.reset} Provider: ${c.bold}${provider}${c.reset} / ${model}`
        : `${c.yellow}⚠${c.reset} No API key — run ${c.cyan}coreblow onboard${c.reset}`;

    console.log(
        `  ${c.green}${c.bold}🚀 CoreBlow Gateway listening${c.reset} on ${endpoints.join(', ')} ${c.dim}(PID ${process.pid})${c.reset}\n` +
        `  ${configStatus}\n` +
        `  ${c.dim}Dashboard: ${endpoints[0]}/  |  Health: ${endpoints[0]}/healthz  |  API: ${endpoints[0]}/api/chat${c.reset}\n`
    );

    // ── Step 8: Graceful Shutdown ─────────────────────────────
    const shutdown = async (signal: string) => {
        console.log(`\n  ${c.yellow}⏳ Received ${signal}, shutting down gracefully...${c.reset}`);

        // Close HTTP server (stop accepting new connections)
        httpServer.close();

        // Stop all channels
        try {
            await channelMgr.stop();
        } catch {
            // Best-effort
        }

        // Close SSE + WS connections
        sseHandler.broadcast('default', { event: 'shutdown', data: { reason: signal } });
        wsHandler.closeAll(`Shutdown: ${signal}`);

        // Shutdown CoreBlowServer subsystems
        try {
            await server.stop();
        } catch {
            // Best-effort
        }

        console.log(`  ${c.green}✓ CoreBlow Gateway stopped.${c.reset} Goodbye! 🐙\n`);
        process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // Keep process alive
    await new Promise<never>(() => {
        // Intentionally never resolves — gateway runs until signal
    });
}
