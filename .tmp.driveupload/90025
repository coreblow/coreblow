import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'phone-control', version: '1.0.0', description: 'Remote phone control via ADB/Appium', tags: ['tool', 'mobile'] },
    configSchema: [
        { key: 'platform', label: 'Platform', type: 'select', options: ['android', 'ios'], default: 'android' },
        { key: 'deviceId', label: 'Device ID', type: 'string' },
    ],
    tools: [{
        name: 'phone',
        description: 'Control phone remotely — tap, swipe, screenshot, app launch',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['tap', 'swipe', 'screenshot', 'launch', 'type', 'back', 'home'], description: 'Action' },
                x: { type: 'number' }, y: { type: 'number' },
                app: { type: 'string', description: 'Package/bundle ID' },
                text: { type: 'string', description: 'Text to type' },
            },
            required: ['action'],
        },
        async execute(args) { return `Phone ${args.action}: ${args.app || args.text || `(${args.x},${args.y})`}`; },
    }],
    async init(ctx) { ctx.logger.info('Phone Control initialized'); },
});
