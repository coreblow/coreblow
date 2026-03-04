/**
 * src/cli/channels.ts
 * CLI: coreblow channels — manage channel connections
 */

import { getConfig } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:channels');

export async function channelsCommand(action?: string) {
    const config = getConfig();

    switch (action) {
        case 'list':
        case undefined: {
            console.log('\n  📡 Channel Status\n');

            const channels = [
                {
                    name: 'Telegram',
                    enabled: !!config.channels.telegram?.token,
                    config: config.channels.telegram?.token ? '✅ Token set' : '❌ No token',
                },
                {
                    name: 'Discord',
                    enabled: !!config.channels.discord?.token,
                    config: config.channels.discord?.token ? '✅ Token set' : '❌ No token',
                },
                {
                    name: 'WhatsApp',
                    enabled: !!config.channels.whatsapp?.enabled,
                    config: config.channels.whatsapp?.enabled ? '✅ Enabled' : '❌ Disabled',
                },
                {
                    name: 'WebChat',
                    enabled: config.channels.webchat?.enabled !== false,
                    config: '✅ Built-in (always available)',
                },
                {
                    name: 'Slack',
                    enabled: !!config.channels.slack?.token,
                    config: config.channels.slack?.token ? '✅ Token set' : '❌ No token',
                },
                {
                    name: 'Signal',
                    enabled: !!config.channels.signal?.enabled,
                    config: config.channels.signal?.enabled ? '✅ Enabled' : '❌ Disabled',
                },
            ];

            for (const ch of channels) {
                const icon = ch.enabled ? '🟢' : '⚫';
                console.log(`  ${icon} ${ch.name.padEnd(12)} ${ch.config}`);
            }

            console.log('');
            console.log('  Use "coreblow configure channels" to update settings.');
            console.log('');
            break;
        }

        case 'test': {
            console.log('\n  Testing channel connections...\n');
            try {
                const res = await fetch(`http://127.0.0.1:${config.port || 3120}/api/health`);
                const data = await res.json() as any;
                console.log(`  Gateway: ${data.status === 'ok' ? '✅' : '❌'}`);
                if (data.channels) {
                    for (const [name, enabled] of Object.entries(data.channels)) {
                        console.log(`  ${name}: ${enabled ? '🟢 Connected' : '⚫ Not connected'}`);
                    }
                }
            } catch {
                console.log('  ❌ Gateway not running. Start with: coreblow gateway start');
            }
            console.log('');
            break;
        }

        default:
            console.log('Usage: coreblow channels [list|test]');
    }
}
