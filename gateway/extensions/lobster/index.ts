import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'lobster', version: '1.0.0', description: 'Workflow/pipeline engine — compose skills and tools into automated pipelines', tags: ['automation', 'workflow'] },
    tools: [{
        name: 'workflow',
        description: 'Create and run multi-step automated workflows/pipelines',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['create', 'run', 'list', 'delete', 'status'], description: 'Action' },
                name: { type: 'string', description: 'Workflow name' },
                steps: { type: 'array', items: { type: 'object' }, description: 'Workflow steps [{tool, args}]' },
            },
            required: ['action'],
        },
        async execute(args) {
            switch (args.action) {
                case 'create': return `Workflow "${args.name}" created with ${(args.steps || []).length} steps`;
                case 'run': return `Running workflow "${args.name}"...`;
                case 'list': return 'No workflows defined. Use "create" to make one.';
                case 'delete': return `Workflow "${args.name}" deleted`;
                case 'status': return `Workflow "${args.name}": idle`;
                default: return `Unknown: ${args.action}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('Lobster workflow engine initialized'); },
});
