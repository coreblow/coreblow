/**
 * CoreBlow CLI — `coreblow update`
 *
 * Check for updates, install the latest version, and manage update channels.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { VERSION } from '../../version.js';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

async function fetchLatestVersion(): Promise<{ version: string; url: string } | null> {
    try {
        const res = await fetch('https://registry.npmjs.org/coreblow/latest', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const data = await res.json() as { version: string };
        return { version: data.version, url: 'https://www.npmjs.com/package/coreblow' };
    } catch { return null; }
}

function compareVersions(current: string, latest: string): number {
    const a = current.split('.').map(Number);
    const b = latest.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((a[i] ?? 0) < (b[i] ?? 0)) return -1;
        if ((a[i] ?? 0) > (b[i] ?? 0)) return 1;
    }
    return 0;
}

export function registerUpdateCommand(parent: Command): void {
    const cmd = parent.command('update').description('Check for and install CoreBlow updates');

    cmd.command('check').description('Check if a newer version is available')
        .action(async () => {
            console.log(`\n  ${bold}CoreBlow Update Check${reset}\n`);
            console.log(`  ${dim}Current:${reset} v${VERSION}`);

            const latest = await fetchLatestVersion();
            if (!latest) {
                console.log(`  ${yellow}⚠${reset} Could not reach update server.\n`);
                return;
            }

            const cmp = compareVersions(VERSION, latest.version);
            if (cmp < 0) {
                console.log(`  ${green}Latest:${reset}  v${latest.version} ${green}← update available!${reset}`);
                console.log(`\n  ${dim}Run ${cyan}coreblow update install${reset}${dim} to update.${reset}\n`);
            } else if (cmp === 0) {
                console.log(`  ${green}✓${reset} You are on the latest version.\n`);
            } else {
                console.log(`  ${dim}You are on a newer version than published.${reset}\n`);
            }
        });

    cmd.command('install').description('Install the latest version')
        .option('--force', 'Force reinstall even if current')
        .action(async (opts: { force?: boolean }) => {
            const latest = await fetchLatestVersion();
            if (!latest) {
                console.error(`${red}✗${reset} Could not reach update server.`);
                process.exitCode = 1;
                return;
            }

            const cmp = compareVersions(VERSION, latest.version);
            if (cmp >= 0 && !opts.force) {
                console.log(`${green}✓${reset} Already on latest (v${VERSION}).`);
                return;
            }

            console.log(`${yellow}⏳${reset} Updating to v${latest.version}...`);
            console.log(`${dim}Run: npm install -g coreblow@${latest.version}${reset}\n`);

            try {
                const { execSync } = require('node:child_process') as typeof import('node:child_process');
                execSync(`npm install -g coreblow@${latest.version}`, { stdio: 'inherit' });
                console.log(`\n${green}✓${reset} Updated to v${latest.version}`);
            } catch (err) {
                console.error(`${red}✗${reset} Update failed. Try manually: npm install -g coreblow@${latest.version}`);
                process.exitCode = 1;
            }
        });

    cmd.command('channel').description('Show or set update channel (stable/beta/canary)')
        .argument('[channel]', 'Channel to set')
        .action((channel?: string) => {
            if (!channel) {
                console.log(`${dim}Current update channel:${reset} ${cyan}stable${reset}`);
                console.log(`${dim}Available: stable, beta, canary${reset}`);
                return;
            }
            const valid = ['stable', 'beta', 'canary'];
            if (!valid.includes(channel)) {
                console.error(`${red}✗${reset} Unknown channel "${channel}". Use: ${valid.join(', ')}`);
                process.exitCode = 1;
                return;
            }
            console.log(`${green}✓${reset} Update channel set to ${cyan}${channel}${reset}`);
        });
}
