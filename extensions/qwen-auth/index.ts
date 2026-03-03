import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'qwen-auth', version: '1.0.0', description: 'Qwen portal auth — browser cookie extraction', tags: ['auth', 'provider'] },
    configSchema: [
        { key: 'cookies', label: 'Qwen Cookies', type: 'password' },
    ],
    tools: [{
        name: 'qwen_auth',
        description: 'Manage Qwen authentication',
        parameters: {
            type: 'object',
            properties: { action: { type: 'string', enum: ['login', 'refresh', 'status'] } },
            required: ['action'],
        },
        async execute(args) { return `Qwen auth ${args.action}`; },
    }],
    async init(ctx) { ctx.logger.info('Qwen Auth initialized'); },
});
