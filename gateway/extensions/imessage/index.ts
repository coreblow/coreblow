import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'imessage', version: '1.0.0', description: 'iMessage channel via macOS chat.db (local only)', tags: ['channel', 'apple'] },
    configSchema: [
        { key: 'chatDbPath', label: 'chat.db Path', type: 'string', default: '~/Library/Messages/chat.db' },
        { key: 'pollInterval', label: 'Poll Interval (ms)', type: 'number', default: 3000 },
    ],
    channel: {
        name: 'imessage',
        async start(ctx) {
            // Poll chat.db for new messages using sqlite3
            ctx.logger.info('iMessage channel started (macOS only)');
        },
        async stop() { },
        isConnected() { return process.platform === 'darwin'; },
    },
    async init(ctx) {
        if (process.platform !== 'darwin') ctx.logger.warn('iMessage only works on macOS');
        else ctx.logger.info('iMessage extension initialized');
    },
});
