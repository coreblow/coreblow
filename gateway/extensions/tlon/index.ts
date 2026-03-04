import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'tlon', version: '1.0.0', description: 'Urbit/Tlon decentralized network channel', tags: ['channel', 'decentralized'] },
    configSchema: [
        { key: 'shipUrl', label: 'Urbit Ship URL', type: 'string', required: true },
        { key: 'code', label: 'Access +code', type: 'password', required: true },
    ],
    channel: { name: 'tlon', async start(ctx) { ctx.logger.info('Tlon/Urbit started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('Tlon extension initialized'); },
});
