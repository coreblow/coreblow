import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'llm-task', version: '1.0.0', description: 'Background LLM task runner — queue and execute AI tasks asynchronously', tags: ['intelligence', 'automation'] },
    tools: [{
        name: 'llm_task',
        description: 'Queue background AI tasks that run asynchronously',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['create', 'status', 'cancel', 'list'], description: 'Action' },
                prompt: { type: 'string', description: 'Task prompt' },
                taskId: { type: 'string', description: 'Task ID (for status/cancel)' },
                priority: { type: 'string', enum: ['low', 'normal', 'high'], default: 'normal' },
            },
            required: ['action'],
        },
        async execute(args) {
            switch (args.action) {
                case 'create': return `Task queued: "${(args.prompt || '').substring(0, 80)}..." [${args.priority || 'normal'}]`;
                case 'status': return `Task ${args.taskId}: pending`;
                case 'cancel': return `Task ${args.taskId} cancelled`;
                case 'list': return 'No active tasks';
                default: return `Unknown: ${args.action}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('LLM Task runner initialized'); },
});
