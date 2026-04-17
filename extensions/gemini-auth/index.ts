import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'gemini-auth', version: '1.0.0', description: 'Google Gemini CLI auth proxy — cookie-based free access', tags: ['auth', 'provider'] },
    configSchema: [
        { key: 'cookies', label: 'Gemini Cookies (JSON)', type: 'password' },
    ],
    tools: [{
        name: 'gemini_auth',
        description: 'Manage Gemini authentication tokens',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['login', 'refresh', 'status', 'logout'] },
            },
            required: ['action'],
        },
        async execute(args) { return `Gemini auth ${args.action}`; },
    }],
    async init(ctx) { ctx.logger.info('Gemini Auth proxy initialized'); },
});
