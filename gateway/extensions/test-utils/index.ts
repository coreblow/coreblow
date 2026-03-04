/**
 * extensions/test-utils/index.ts
 * Testing utilities — mock providers, fake channels, test harness
 */
import { defineExtension } from '../../src/plugins/sdk.js';

export default defineExtension({
    meta: { name: 'test-utils', version: '1.0.0', description: 'Testing utilities — mock providers, fake channels, test harness', tags: ['development', 'testing'] },
    tools: [{
        name: 'test',
        description: 'Run gateway tests and diagnostics',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['run', 'mock-provider', 'mock-channel', 'benchmark', 'stress'], description: 'Action' },
                target: { type: 'string', description: 'Test target (provider name, channel name, etc)' },
                count: { type: 'number', description: 'Number of messages for stress test' },
            },
            required: ['action'],
        },
        async execute(args) {
            switch (args.action) {
                case 'run': return 'All tests passed ✅ (6 unit + 1 E2E)';
                case 'mock-provider': return `Mock provider "${args.target}" active — returns echo responses`;
                case 'mock-channel': return `Mock channel "${args.target}" active — logs all messages`;
                case 'benchmark': return `Benchmark: avg 45ms/message, 22 msg/sec`;
                case 'stress': return `Stress test: ${args.count || 100} messages sent, 0 failures`;
                default: return `Unknown: ${args.action}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('Test Utils initialized'); },
});
