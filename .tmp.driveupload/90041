import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'copilot-proxy', version: '1.0.0', description: 'GitHub Copilot-compatible proxy — use CoreBlow as Copilot backend', tags: ['tool', 'development'] },
    configSchema: [
        { key: 'port', label: 'Proxy Port', type: 'number', default: 3180 },
        { key: 'provider', label: 'AI Provider', type: 'select', options: ['ollama', 'openai', 'anthropic'], default: 'ollama' },
    ],
    tools: [{
        name: 'copilot_proxy',
        description: 'Manage Copilot-compatible code completion proxy',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['start', 'stop', 'status'], description: 'Action' },
            },
            required: ['action'],
        },
        async execute(args) { return `Copilot proxy ${args.action}`; },
    }],
    async init(ctx) { ctx.logger.info('Copilot Proxy initialized'); },
});
