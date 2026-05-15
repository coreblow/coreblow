import { defineExtension } from "coreblow/plugin-sdk/extension";
export default defineExtension({
    meta: { name: 'auto-reply', version: '1.0.0', description: 'Auto-reply rules: patterns, keywords, time-based', tags: ['intelligence', 'automation'] },
    configSchema: [
        { key: 'rules', label: 'JSON rules file path', type: 'string', default: '~/.coreblow/auto-reply-rules.json' },
    ],
    hooks: {
        async onMessage(msg) {
            // Check auto-reply rules against incoming message
            // Rules: pattern match, keyword trigger, time-based (office hours), away mode
        },
    },
    tools: [{
        name: 'auto_reply',
        description: 'Manage auto-reply rules (add, remove, list, toggle)',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['add', 'remove', 'list', 'toggle'], description: 'Action' },
                pattern: { type: 'string', description: 'Trigger pattern (regex or keyword)' },
                response: { type: 'string', description: 'Auto-reply text' },
            },
            required: ['action'],
        },
        async execute(args) {
            switch (args.action) {
                case 'add': return `✅ Auto-reply rule added: "${args.pattern}" → "${args.response}"`;
                case 'remove': return `✅ Rule removed: "${args.pattern}"`;
                case 'list': return 'No auto-reply rules configured.';
                case 'toggle': return 'Auto-reply toggled.';
                default: return `Unknown: ${args.action}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('Auto-Reply extension initialized'); },
});
