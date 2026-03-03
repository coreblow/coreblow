// @ts-nocheck
import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'tts', version: '1.0.0', description: 'Text-to-Speech (OpenAI, ElevenLabs, local)', tags: ['media', 'voice'] },
    configSchema: [
        { key: 'provider', label: 'TTS Provider', type: 'select', options: ['openai', 'elevenlabs', 'sherpa-onnx'], default: 'openai' },
        { key: 'apiKey', label: 'API Key', type: 'password' },
        { key: 'voice', label: 'Voice ID', type: 'string', default: 'alloy' },
    ],
    tools: [{
        name: 'tts',
        description: 'Convert text to speech audio',
        parameters: {
            type: 'object',
            properties: {
                text: { type: 'string', description: 'Text to convert' },
                voice: { type: 'string', description: 'Voice preset' },
            },
            required: ['text'],
        },
        async execute(args) { return `TTS: "${(args.text || '').substring(0, 100)}" voice=${args.voice || 'alloy'}`; },
    }],
    async init(ctx) { ctx.logger.info('TTS extension initialized'); },
});
