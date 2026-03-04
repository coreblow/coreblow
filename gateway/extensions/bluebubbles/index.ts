import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'bluebubbles', version: '1.0.0', description: 'iMessage via BlueBubbles (macOS)', tags: ['channel', 'apple'] },
    configSchema: [
        { key: 'url', label: 'BlueBubbles URL', type: 'string', required: true },
        { key: 'password', label: 'Server Password', type: 'password', required: true },
    ],
    channel: { name: 'bluebubbles', async start(ctx) { ctx.logger.info('BlueBubbles started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('BlueBubbles iMessage initialized'); },
});
