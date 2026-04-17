/**
 * extensions/mattermost/index.ts
 * Mattermost channel extension — WebSocket + REST API
 */
import { defineExtension } from '../../src/plugins/sdk.js';

export default defineExtension({
    meta: {
        name: 'mattermost',
        version: '1.0.0',
        description: 'Mattermost team chat integration',
        tags: ['channel', 'enterprise'],
    },
    configSchema: [
        { key: 'url', label: 'Mattermost URL', type: 'string', required: true },
        { key: 'token', label: 'Bot Access Token', type: 'password', required: true },
    ],
    channel: {
        name: 'mattermost',
        async start(ctx) {
            const WebSocket = (await import('ws')).default;
            const wsUrl = ctx.config.url.replace(/^http/, 'ws') + '/api/v4/websocket';
            const ws = new WebSocket(wsUrl);
            ws.on('open', () => {
                ws.send(JSON.stringify({ seq: 1, action: 'authentication_challenge', data: { token: ctx.config.token } }));
                ctx.logger.info('Mattermost WebSocket connected');
            });
            ws.on('message', (raw: any) => {
                const data = JSON.parse(raw.toString());
                if (data.event === 'posted') {
                    const post = JSON.parse(data.data.post);
                    if (!post.props?.from_bot) {
                        ctx.gateway.sendMessage('mattermost', post.user_id, post.message);
                    }
                }
            });
        },
        async stop() { },
        isConnected() { return true; },
    },
    async init(ctx) { ctx.logger.info('Mattermost extension initialized'); },
});
