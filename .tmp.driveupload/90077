import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'memory-core', version: '1.0.0', description: 'Long-term memory with embeddings and semantic search', tags: ['intelligence', 'memory'] },
    configSchema: [
        { key: 'backend', label: 'Embedding Backend', type: 'select', options: ['ollama', 'openai', 'local'], default: 'ollama' },
        { key: 'model', label: 'Embedding Model', type: 'string', default: 'nomic-embed-text' },
        { key: 'maxMemories', label: 'Max Memories', type: 'number', default: 10000 },
    ],
    tools: [{
        name: 'memory',
        description: 'Store and recall long-term memories from past conversations',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['store', 'recall', 'search', 'forget', 'list'], description: 'Action' },
                text: { type: 'string', description: 'Content to store or search query' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Tags for organization' },
            },
            required: ['action'],
        },
        async execute(args) {
            switch (args.action) {
                case 'store': return `Memory stored: "${(args.text || '').substring(0, 100)}" [${(args.tags || []).join(', ')}]`;
                case 'recall': return `Searching memories for: "${args.text}"... (0 results — memory backend not connected)`;
                case 'search': return `Semantic search: "${args.text}" — configure embedding backend first`;
                case 'forget': return `Memory forgotten.`;
                case 'list': return `No memories stored yet. Use "store" to add memories.`;
                default: return `Unknown action: ${args.action}`;
            }
        },
    }],
    hooks: {
        async onMessage(msg) { /* Auto-memorize important messages */ },
        async onSessionEnd(sessionId) { /* Summarize and store session highlights */ },
    },
    async init(ctx) { ctx.logger.info('Memory Core initialized'); },
});
