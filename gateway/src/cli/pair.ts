/**
 * src/cli/pair.ts
 * CLI: coreblow pair — generate pairing code + manage devices
 */

import { PairingManager } from '../gateway/pairing.js';
import { getHomeDir } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('cli:pair');

export async function pairCommand(action?: string) {
    const homeDir = getHomeDir();
    const pairing = new PairingManager(homeDir);

    switch (action) {
        case 'generate':
        case undefined: {
            // Default: generate a new pairing code
            const { code, expiresIn } = pairing.generateCode();
            console.log('');
            console.log('  🔗 Device Pairing Code');
            console.log('  ─────────────────────');
            console.log(`  Code:    ${code}`);
            console.log(`  Expires: ${expiresIn}`);
            console.log('');
            console.log('  Enter this code on your device to connect.');
            console.log('  The code is single-use and time-limited.');
            console.log('');

            // Keep process alive to accept the pairing
            console.log('  Waiting for device to pair... (Ctrl+C to cancel)');

            // Poll every 2s to check if code was consumed
            const interval = setInterval(() => {
                // Code got consumed = device list grew
                const devices = pairing.listDevices();
                const recent = devices.find(d => Date.now() - d.pairedAt < 30_000);
                if (recent) {
                    console.log('');
                    console.log(`  ✅ Device paired: ${recent.name} (${recent.platform})`);
                    console.log(`  Device ID: ${recent.id}`);
                    console.log('');
                    clearInterval(interval);
                    process.exit(0);
                }
            }, 2000);

            // Timeout after 5 minutes
            setTimeout(() => {
                console.log('  ⏰ Pairing code expired. Run again to generate a new one.');
                clearInterval(interval);
                process.exit(0);
            }, 5 * 60 * 1000);

            break;
        }

        case 'list': {
            const devices = pairing.listDevices();
            if (devices.length === 0) {
                console.log('No paired devices.');
                return;
            }
            console.log(`\n  Paired Devices (${devices.length}):\n`);
            for (const d of devices) {
                const ago = Math.round((Date.now() - d.lastSeen) / 1000);
                const agoStr = ago < 60 ? `${ago}s ago` : ago < 3600 ? `${Math.round(ago / 60)}m ago` : `${Math.round(ago / 3600)}h ago`;
                console.log(`  📱 ${d.name} (${d.platform})`);
                console.log(`     ID: ${d.id}`);
                console.log(`     Paired: ${new Date(d.pairedAt).toLocaleString()}`);
                console.log(`     Last seen: ${agoStr}`);
                console.log('');
            }
            break;
        }

        case 'revoke': {
            const devices = pairing.listDevices();
            if (devices.length === 0) {
                console.log('No paired devices to revoke.');
                return;
            }
            const count = pairing.revokeAll();
            console.log(`✅ Revoked ${count} device(s).`);
            break;
        }

        default:
            console.log('Usage: coreblow pair [generate|list|revoke]');
    }
}
