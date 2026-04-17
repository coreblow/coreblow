import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'memory-lancedb', version: '1.0.0', description: 'Vector database backend using LanceDB', tags: ['intelligence', 'memory', 'vector'] },
    configSchema: [
        { key: 'dbPath', label: 'Database Path', type: 'string', default: '~/.coreblow/memory/lancedb' },
    ],
    async init(ctx) { ctx.logger.info('LanceDB memory backend initialized'); },
});
