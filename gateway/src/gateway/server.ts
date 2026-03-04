/**
 * src/gateway/server.ts
 * CoreBlow Gateway — HTTP + WebSocket server
 */

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { loadConfig, getConfig, watchConfig, getHomeDir } from './config.js';
import { ProtocolHandler } from './protocol.js';
import { MessageRouter } from './router.js';
import { healthHandler } from './health.js';
import { getStore, closeStore } from '../utils/store.js';
import { mountDashboard } from '../dashboard/serve.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('server');

export class GatewayServer {
    private app: express.Application;
    private server: http.Server;
    private wss: WebSocketServer;
    public protocol: ProtocolHandler;
    public router: MessageRouter;

    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });
        this.protocol = new ProtocolHandler();
        this.router = new MessageRouter();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.disable('x-powered-by');
    }

    private setupRoutes() {
        // Health check
        this.app.get('/api/health', healthHandler);

        // Gateway info
        this.app.get('/api/info', (_req, res) => {
            res.json({
                name: 'CoreBlow Gateway',
                version: '1.0.0',
                wsClients: this.protocol.getClientCount(),
            });
        });

        // Config (protected)
        this.app.get('/api/config', (req, res) => {
            const config = getConfig();
            if (!this.checkAuth(req)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            // Redact secrets
            const safe = JSON.parse(JSON.stringify(config));
            if (safe.providers?.openai?.apiKey) safe.providers.openai.apiKey = '***';
            if (safe.providers?.anthropic?.apiKey) safe.providers.anthropic.apiKey = '***';
            if (safe.providers?.openrouter?.apiKey) safe.providers.openrouter.apiKey = '***';
            if (safe.channels?.telegram?.token) safe.channels.telegram.token = '***';
            if (safe.channels?.discord?.token) safe.channels.discord.token = '***';
            if (safe.token) safe.token = '***';
            res.json(safe);
        });

        // Dashboard
        mountDashboard(this.app);

        // Fallback
        this.app.use((_req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
    }

    private wsClients: Map<string, WebSocket> = new Map();

    private setupWebSocket() {
        // Register WebChat sender once
        this.router.registerChannelSender('webchat', async (msg) => {
            const ws = this.wsClients.get(msg.senderId);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'message',
                    data: { text: msg.text, from: 'assistant', timestamp: Date.now() },
                }));
            }
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
            const clientId = randomUUID();
            const ip = req.socket.remoteAddress || 'unknown';
            log.info({ clientId, ip }, 'WebSocket connection');

            this.wsClients.set(clientId, ws);
            this.protocol.handleConnection(ws, clientId);

            // Handle WebChat messages
            this.protocol.on('message', (client, msg) => {
                if (!msg.data?.text) return;

                const inbound = {
                    channel: 'webchat',
                    senderId: client.id,
                    senderName: client.metadata.name || 'WebChat User',
                    sessionId: MessageRouter.deriveSessionId('webchat', client.id),
                    text: msg.data.text,
                    timestamp: Date.now(),
                };

                this.router.routeInbound(inbound);
            });

            ws.on('close', () => {
                this.wsClients.delete(clientId);
            });
        });
    }

    private checkAuth(req: express.Request): boolean {
        const config = getConfig();
        if (!config.token) return true; // No token = no auth required
        const header = req.headers.authorization;
        if (!header) return false;
        const token = header.replace('Bearer ', '');
        return token === config.token;
    }

    async start() {
        const config = loadConfig();
        const homeDir = getHomeDir();

        // Initialize SQLite
        getStore(homeDir);

        // Watch config for hot-reload
        watchConfig((newConfig) => {
            log.info('Config reloaded');
        });

        // Initialize agent system
        const { AgentManager } = await import('../agents/manager.js');
        const { AgentTurn } = await import('../agents/turn.js');
        const { ToolRegistry } = await import('../tools/registry.js');
        const { execTool } = await import('../tools/exec.js');
        const { webFetchTool } = await import('../tools/web_fetch.js');
        const { cronTool } = await import('../tools/cron.js');

        const agentManager = new AgentManager();
        await agentManager.init();

        // Register tools
        const toolRegistry = new ToolRegistry();
        toolRegistry.register(execTool);
        toolRegistry.register(webFetchTool);
        toolRegistry.register(cronTool);

        // Try to register optional tools
        try {
            const { webSearchTool } = await import('../tools/web_search.js');
            toolRegistry.register(webSearchTool);
        } catch { /* optional */ }
        try {
            const { imageTool } = await import('../tools/image.js');
            toolRegistry.register(imageTool);
        } catch { /* optional */ }

        // Create agent turn loop
        const turn = new AgentTurn(agentManager, this.router);
        turn.setToolExecutor((name, args) => toolRegistry.execute(name, args));

        // Connect router to turn loop
        this.router.onMessage(async (inbound) => {
            await turn.runTurn(inbound);
        });

        // Start channels
        if (config.channels.telegram?.token) {
            try {
                const { TelegramChannel } = await import('../channels/telegram.js');
                const telegram = new TelegramChannel(config.channels.telegram.token);
                await telegram.start(this.router);
                log.info('📱 Telegram channel started');
            } catch (err: any) {
                log.error({ err: err.message }, 'Failed to start Telegram');
            }
        }

        return new Promise<void>((resolve) => {
            this.server.listen(config.port, config.host, () => {
                log.info(
                    { host: config.host, port: config.port },
                    `🚀 CoreBlow Gateway running at http://${config.host}:${config.port}`
                );
                log.info(`   Health: http://${config.host}:${config.port}/api/health`);
                log.info(`   WebSocket: ws://${config.host}:${config.port}`);
                log.info(`   Model: ${config.agent.provider}/${config.agent.model}`);
                resolve();
            });
        });
    }

    async stop() {
        log.info('Shutting down gateway...');
        closeStore();

        return new Promise<void>((resolve, reject) => {
            // Close all WebSocket connections
            this.wss.clients.forEach((ws) => ws.close());

            this.server.close((err) => {
                if (err) reject(err);
                else {
                    log.info('Gateway stopped');
                    resolve();
                }
            });
        });
    }
}
