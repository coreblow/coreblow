import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'thread-ownership', version: '1.0.0', description: 'Manage conversation thread ownership and permissions', tags: ['tool', 'security'] },
    tools: [{
        name: 'thread_ownership',
        description: 'Set or check conversation thread ownership/permissions',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['set', 'check', 'transfer', 'lock'], description: 'Action' },
                threadId: { type: 'string', description: 'Thread/session ID' },
                owner: { type: 'string', description: 'Owner user ID' },
            },
            required: ['action'],
        },
        async execute(args) { return `Thread ${args.action}: ${args.threadId || 'current'} → ${args.owner || 'N/A'}`; },
    }],
    async init(ctx) { ctx.logger.info('Thread Ownership extension initialized'); },
});
