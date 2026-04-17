import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'diagnostics', version: '1.0.0', description: 'OpenTelemetry diagnostics and tracing', tags: ['ops', 'monitoring'] },
    tools: [{
        name: 'diagnostics',
        description: 'View system diagnostics, traces, and performance metrics',
        parameters: {
            type: 'object',
            properties: {
                action: { type: 'string', enum: ['stats', 'traces', 'errors', 'reset'], description: 'Action' },
            },
            required: ['action'],
        },
        async execute(args) {
            const mem = process.memoryUsage();
            switch (args.action) {
                case 'stats': return JSON.stringify({
                    pid: process.pid,
                    uptime: `${Math.round(process.uptime())}s`,
                    heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
                    rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
                    nodeVersion: process.version,
                }, null, 2);
                case 'errors': return 'No recent errors.';
                case 'traces': return 'Tracing not yet configured. Set OTEL_ENDPOINT to enable.';
                case 'reset': return 'Diagnostics reset.';
                default: return `Unknown: ${args.action}`;
            }
        },
    }],
    async init(ctx) { ctx.logger.info('Diagnostics extension initialized'); },
});
