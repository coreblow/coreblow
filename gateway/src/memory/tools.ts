/**
 * src/memory/tools.ts
 * Memory tools — expose memory system as agent tools
 */

import type { ToolHandler } from '../tools/types.js';
import type { MemoryManager } from './manager.js';

/**
 * Create memory tools for the agent
 */
export function createMemoryTools(memory: MemoryManager): ToolHandler[] {
    return [
        {
            name: 'memory_store',
            description: 'Store information in long-term memory for future recall. Use this to remember important facts, user preferences, or notable events.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'The information to remember' },
                    type: { type: 'string', enum: ['fact', 'preference', 'note', 'summary'], description: 'Type of memory', default: 'note' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
                    importance: { type: 'number', description: 'Importance score 0-1 (1 = critical)', default: 0.5 },
                },
                required: ['text'],
            },
            async execute(args: any): Promise<string> {
                const id = await memory.store_memory(args.text, {
                    type: args.type || 'note',
                    tags: args.tags || [],
                    importance: args.importance ?? 0.5,
                    source: 'tool',
                });
                return `✅ Memory stored (id: ${id}): "${args.text.substring(0, 100)}"`;
            },
        },
        {
            name: 'memory_recall',
            description: 'Search long-term memory for relevant information. Uses semantic similarity to find related memories.',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'What to search for in memory' },
                    topK: { type: 'number', description: 'Max results to return', default: 5 },
                    type: { type: 'string', enum: ['fact', 'preference', 'note', 'summary', 'message'], description: 'Filter by memory type' },
                },
                required: ['query'],
            },
            async execute(args: any): Promise<string> {
                const results = await memory.recall(args.query, {
                    topK: args.topK || 5,
                    type: args.type,
                });

                if (results.length === 0) {
                    // Fallback to keyword search
                    const kwResults = memory.searchKeyword(args.query, args.topK || 5);
                    if (kwResults.length === 0) {
                        return `No memories found for "${args.query}".`;
                    }
                    return formatResults(kwResults, 'keyword');
                }

                return formatResults(results, 'semantic');
            },
        },
        {
            name: 'memory_forget',
            description: 'Delete a specific memory by its ID.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Memory ID to delete' },
                },
                required: ['id'],
            },
            async execute(args: any): Promise<string> {
                const deleted = memory.forget(args.id);
                return deleted
                    ? `✅ Memory ${args.id} forgotten.`
                    : `Memory ${args.id} not found.`;
            },
        },
        {
            name: 'memory_list',
            description: 'List recent memories or filter by tag.',
            parameters: {
                type: 'object',
                properties: {
                    count: { type: 'number', description: 'Number of recent memories', default: 10 },
                    tag: { type: 'string', description: 'Filter by tag' },
                },
            },
            async execute(args: any): Promise<string> {
                let entries;
                if (args.tag) {
                    entries = memory.byTag(args.tag);
                } else {
                    entries = memory.recent(args.count || 10);
                }

                if (entries.length === 0) {
                    return args.tag ? `No memories tagged "${args.tag}".` : 'No memories stored yet.';
                }

                const lines = entries.map(e => {
                    const age = formatAge(e.metadata.timestamp);
                    const tags = e.metadata.tags.length > 0 ? ` [${e.metadata.tags.join(', ')}]` : '';
                    return `- [${e.id}] (${e.metadata.type}) ${e.text.substring(0, 120)}${tags} — ${age}`;
                });

                return `📝 Memories (${entries.length}):\n${lines.join('\n')}`;
            },
        },
        {
            name: 'memory_stats',
            description: 'Get memory system statistics — total count, types, storage size.',
            parameters: { type: 'object', properties: {} },
            async execute(): Promise<string> {
                const s = memory.stats();
                return [
                    `📊 Memory Stats:`,
                    `  Total: ${s.count} memories`,
                    `  Types: ${Object.entries(s.types).map(([k, v]) => `${k}=${v}`).join(', ')}`,
                    `  Backend: ${s.embeddingBackend} (${s.embeddingDimensions}d)`,
                    `  Storage: ${(s.sizeBytes / 1024).toFixed(1)} KB`,
                    `  Auto-memorize: ${s.autoMemorize ? 'ON' : 'OFF'}`,
                    s.count > 0 ? `  Oldest: ${formatAge(s.oldestMs)}, Newest: ${formatAge(s.newestMs)}` : '',
                ].filter(Boolean).join('\n');
            },
        },
    ];
}

function formatResults(results: Array<{ entry: any; score: number }>, method: string): string {
    const lines = results.map(r => {
        const age = formatAge(r.entry.metadata.timestamp);
        const pct = (r.score * 100).toFixed(0);
        const tags = r.entry.metadata.tags?.length > 0 ? ` [${r.entry.metadata.tags.join(', ')}]` : '';
        return `- [${r.entry.id}] (${pct}% ${method}) ${r.entry.text.substring(0, 150)}${tags} — ${age}`;
    });
    return `🔍 Found ${results.length} memories:\n${lines.join('\n')}`;
}

function formatAge(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
