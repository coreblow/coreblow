import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'open-prose', version: '1.0.0', description: 'AI writing assistant — grammar, style, rewriting, summarizing', tags: ['tool', 'writing'] },
    tools: [{
        name: 'prose',
        description: 'AI writing assistant for grammar, style, rewriting, and summarization',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['rewrite', 'grammar', 'summarize', 'expand', 'translate', 'tone'], description: 'Action' },
                text: { type: 'string', description: 'Input text' },
                style: { type: 'string', description: 'Target style/tone (formal, casual, academic)' },
                language: { type: 'string', description: 'Target language for translation' },
            },
            required: ['action', 'text'],
        },
        async execute(args) { return `Prose ${args.action}: "${(args.text || '').substring(0, 100)}..." [${args.style || args.language || 'default'}]`; },
    }],
    async init(ctx) { ctx.logger.info('Open Prose writing assistant initialized'); },
});
