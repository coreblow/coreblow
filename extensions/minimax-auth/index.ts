import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'minimax-auth', version: '1.0.0', description: 'MiniMax portal auth — browser cookie extraction', tags: ['auth', 'provider'] },
    configSchema: [
        { key: 'cookies', label: 'MiniMax Cookies', type: 'password' },
    ],
    tools: [{
        name: 'minimax_auth',
        description: 'Manage MiniMax authentication',
        parameters: {
            type: 'object',
            properties: { action: { type: 'string', enum: ['login', 'refresh', 'status'] } },
            required: ['action'],
        },
        async execute(args) { return `MiniMax auth ${args.action}`; },
    }],
    async init(ctx) { ctx.logger.info('MiniMax Auth initialized'); },
});
