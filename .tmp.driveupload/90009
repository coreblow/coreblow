import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'voice-call', version: '1.0.0', description: 'Voice call support (Twilio, Plivo, Telnyx)', tags: ['communication', 'voice'] },
    configSchema: [
        { key: 'provider', label: 'Voice Provider', type: 'select', options: ['twilio', 'plivo', 'telnyx'], default: 'twilio' },
        { key: 'accountSid', label: 'Account SID', type: 'string', required: true },
        { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
        { key: 'phoneNumber', label: 'Phone Number', type: 'string', required: true },
    ],
    tools: [{
        name: 'voice_call',
        description: 'Make or manage voice calls (Twilio/Plivo/Telnyx)',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['call', 'hangup', 'status'], description: 'Action' },
                to: { type: 'string', description: 'Phone number to call' },
                message: { type: 'string', description: 'TTS message to speak' },
            },
            required: ['action'],
        },
        async execute(args) { return `Voice call ${args.action}: ${args.to || 'N/A'} — ${args.message || ''}`; },
    }],
    async init(ctx) { ctx.logger.info('Voice Call extension initialized'); },
});
