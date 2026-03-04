import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'diffs', version: '1.0.0', description: 'View and apply code diffs/patches', tags: ['tool', 'development'] },
    tools: [{
        name: 'diff',
        description: 'Generate, view, or apply code diffs between files or versions',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['generate', 'apply', 'view'], description: 'Action' },
                file: { type: 'string', description: 'File path' },
                patch: { type: 'string', description: 'Unified diff patch content' },
            },
            required: ['action'],
        },
        async execute(args) { return `Diff ${args.action}: ${args.file || 'N/A'}`; },
    }],
    async init(ctx) { ctx.logger.info('Diffs extension initialized'); },
});
