/**
 * CoreBlow CLI — `coreblow devices`
 *
 * Device pairing and token management.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

const DEVICES_FILE = path.join(os.homedir(), '.coreblow', 'devices.json');

interface DeviceEntry {
    id: string;
    name: string;
    platform: string;
    token: string;
    paired: boolean;
    lastActive?: string;
    createdAt: string;
}

function loadDevices(): DeviceEntry[] {
    try { return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8')); } catch { return []; }
}
function saveDevices(devices: DeviceEntry[]): void {
    fs.mkdirSync(path.dirname(DEVICES_FILE), { recursive: true });
    fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2) + '\n', 'utf8');
}
function maskToken(t: string): string {
    if (t.length <= 8) return '••••••••';
    return t.slice(0, 8) + '••••';
}

export function registerDevicesCommand(parent: Command): void {
    const cmd = parent.command('devices').description('Device pairing and token management');

    cmd.command('list').alias('ls').description('List paired devices')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const devices = loadDevices();
            if (opts.json) { console.log(JSON.stringify(devices.map(d => ({ ...d, token: maskToken(d.token) })), null, 2)); return; }
            console.log(`\n  ${bold}Devices${reset} (${devices.length})\n`);
            if (devices.length === 0) { console.log(`  ${dim}No devices paired.${reset}\n`); return; }
            for (const d of devices) {
                const icon = d.paired ? `${green}●${reset}` : `${yellow}◐${reset}`;
                const last = d.lastActive ? `${dim}active: ${d.lastActive}${reset}` : '';
                console.log(`  ${icon} ${cyan}${d.name}${reset} (${d.platform})  ${dim}${maskToken(d.token)}${reset}  ${last}`);
            }
            console.log();
        });

    cmd.command('add <name>').description('Register a new device')
        .option('--platform <platform>', 'Device platform (ios, android, web, desktop)', 'desktop')
        .action((name: string, opts: { platform: string }) => {
            const devices = loadDevices();
            if (devices.find(d => d.name === name)) {
                console.error(`${red}✗${reset} Device "${name}" already exists.`);
                process.exitCode = 1;
                return;
            }
            const id = `dev-${crypto.randomBytes(6).toString('hex')}`;
            const token = `cb_${crypto.randomBytes(24).toString('base64url')}`;
            devices.push({ id, name, platform: opts.platform, token, paired: true, createdAt: new Date().toISOString() });
            saveDevices(devices);
            console.log(`${green}✓${reset} Device ${cyan}${name}${reset} registered.`);
            console.log(`${dim}Token:${reset} ${bold}${token}${reset}`);
            console.log(`${yellow}⚠${reset} Save this token — it won't be shown again.`);
        });

    cmd.command('remove <name>').alias('rm').description('Remove a device')
        .action((name: string) => {
            const devices = loadDevices();
            const idx = devices.findIndex(d => d.name === name || d.id === name);
            if (idx === -1) { console.error(`${red}✗${reset} Device not found.`); process.exitCode = 1; return; }
            devices.splice(idx, 1); saveDevices(devices);
            console.log(`${green}✓${reset} Removed device ${cyan}${name}${reset}`);
        });

    cmd.command('revoke <name>').description('Revoke and regenerate token for a device')
        .action((name: string) => {
            const devices = loadDevices();
            const d = devices.find(d => d.name === name || d.id === name);
            if (!d) { console.error(`${red}✗${reset} Device not found.`); process.exitCode = 1; return; }
            d.token = `cb_${crypto.randomBytes(24).toString('base64url')}`;
            saveDevices(devices);
            console.log(`${green}✓${reset} Token revoked for ${cyan}${name}${reset}.`);
            console.log(`${dim}New token:${reset} ${bold}${d.token}${reset}`);
        });
}
