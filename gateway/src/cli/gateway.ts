/**
 * src/cli/gateway.ts
 * CLI: coreblow gateway start|stop|status
 */

import { GatewayServer } from '../gateway/server.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:gateway');

export async function gatewayCommand(action: string) {
    switch (action) {
        case 'start':
            await startGateway();
            break;
        case 'status':
            await checkStatus();
            break;
        case 'stop':
            log.info('Use Ctrl+C to stop the gateway');
            break;
        default:
            console.log('Usage: coreblow gateway <start|status|stop>');
    }
}

async function startGateway() {
    const server = new GatewayServer();

    // Graceful shutdown
    const shutdown = async () => {
        await server.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await server.start();

    // Keep the process alive — wait forever until shutdown signal
    await new Promise(() => { });
}

async function checkStatus() {
    try {
        const res = await fetch('http://127.0.0.1:3120/api/health');
        if (res.ok) {
            const data = await res.json();
            console.log('✅ Gateway is running');
            console.log(`   Uptime: ${data.uptimeHuman}`);
            console.log(`   Model: ${data.agent.provider}/${data.agent.model}`);
            console.log(`   Channels: ${Object.entries(data.channels).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`);
            console.log(`   WebSocket clients: check /api/info`);
        } else {
            console.log('❌ Gateway returned error:', res.status);
        }
    } catch {
        console.log('❌ Gateway is not running (no response on port 3120)');
    }
}
