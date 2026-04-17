import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'talk-voice', version: '1.0.0', description: 'Voice chat rooms — real-time audio conversations', tags: ['communication', 'voice'] },
    configSchema: [
        { key: 'sttProvider', label: 'STT Provider', type: 'select', options: ['whisper', 'openai-realtime', 'local'], default: 'whisper' },
        { key: 'ttsProvider', label: 'TTS Provider', type: 'select', options: ['openai', 'elevenlabs', 'sherpa-onnx'], default: 'openai' },
    ],
    tools: [{
        name: 'voice_room',
        description: 'Manage real-time voice chat rooms',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['create', 'join', 'leave', 'list', 'mute', 'unmute'], description: 'Action' },
                roomId: { type: 'string', description: 'Room identifier' },
            },
            required: ['action'],
        },
        async execute(args) { return `Voice room ${args.action}: ${args.roomId || 'new-room'}`; },
    }],
    async init(ctx) { ctx.logger.info('Talk Voice rooms initialized'); },
});
