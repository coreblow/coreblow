/**
 * extensions/google-chat/index.ts
 * Google Chat channel extension
 */
import { defineExtension } from "coreblow/plugin-sdk/extension";

export default defineExtension({
    meta: {
        name: 'google-chat',
        version: '1.0.0',
        description: 'Google Chat channel via webhook',
        tags: ['channel', 'google'],
    },
    channel: {
        name: 'google-chat',
        async start(ctx) {
            const http = await import('node:http');
            const port = ctx.config.webhookPort || 3170;
            const server = http.createServer(async (req, res) => {
                if (req.method !== 'POST') { res.writeHead(404); res.end(); return; }
                const chunks: Buffer[] = [];
                for await (const chunk of req) chunks.push(chunk as Buffer);
                const body = JSON.parse(Buffer.concat(chunks).toString());
                res.writeHead(200, { 'Content-Type': 'application/json' });
                if (body.type === 'MESSAGE' && body.message?.text) {
                    const text = body.message.text.replace(/<users\/\d+>/g, '').trim();
                    ctx.gateway.sendMessage('google-chat', body.message.sender?.name || 'user', text);
                }
                res.end('{}');
            });
            server.listen(port);
            ctx.logger.info(`Google Chat webhook started on port ${port}`);
        },
        async stop() { },
        isConnected() { return true; },
        async send(target, text) {
            // Reply via webhook response (inline) or REST API
        },
    },
    async init(ctx) { ctx.logger.info('Google Chat extension initialized'); },
});
