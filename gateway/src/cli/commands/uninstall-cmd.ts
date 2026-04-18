/**
 * CoreBlow CLI — `coreblow uninstall`
 *
 * Remove gateway service and clean up local data.
 * Requires --confirm for safety.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const PID_FILE = path.join(CONFIG_DIR, 'gateway.pid');

export function registerUninstallCommand(parent: Command): void {
    parent
        .command('uninstall')
        .description('Uninstall gateway service + local data (CLI remains)')
        .option('--confirm', 'Required to proceed with uninstall')
        .option('--keep-config', 'Keep config file, only remove service and logs')
        .action((opts: { confirm?: boolean; keepConfig?: boolean }) => {
            if (!opts.confirm) {
                console.log(`\n  ${yellow}⚠ CoreBlow Uninstall${reset}\n`);
                console.log(`  This will:`);
                console.log(`    ${red}✗${reset} Stop the running gateway`);
                console.log(`    ${red}✗${reset} Remove service configuration`);
                if (!opts.keepConfig) {
                    console.log(`    ${red}✗${reset} Delete ${CONFIG_DIR}/`);
                }
                console.log(`    ${dim}∙${reset} Keep the CLI binary installed\n`);
                console.log(`  ${dim}Add ${bold}--confirm${reset}${dim} to proceed.${reset}`);
                console.log(`  ${dim}Add ${bold}--keep-config${reset}${dim} to preserve config.${reset}\n`);
                return;
            }

            console.log(`\n  ${bold}Uninstalling CoreBlow...${reset}\n`);

            // 1. Stop running gateway
            try {
                const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
                if (!Number.isNaN(pid)) {
                    try { process.kill(pid, 'SIGTERM'); console.log(`  ${green}✓${reset} Stopped gateway (PID ${pid})`); }
                    catch { /* already dead */ }
                }
            } catch { /* no PID file */ }

            // 2. Remove launchd/systemd service (best-effort)
            const launchdPlist = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.coreblow.gateway.plist');
            if (fs.existsSync(launchdPlist)) {
                try {
                    const { execSync } = require('node:child_process') as typeof import('node:child_process');
                    execSync(`launchctl unload "${launchdPlist}"`, { stdio: 'pipe' });
                    fs.unlinkSync(launchdPlist);
                    console.log(`  ${green}✓${reset} Removed LaunchAgent`);
                } catch { /* ok */ }
            }

            // 3. Remove data directory
            if (!opts.keepConfig) {
                if (fs.existsSync(CONFIG_DIR)) {
                    fs.rmSync(CONFIG_DIR, { recursive: true, force: true });
                    console.log(`  ${green}✓${reset} Removed ${CONFIG_DIR}/`);
                }
            } else {
                // Only remove non-config files
                const removable = ['logs', 'sessions', 'backups', 'gateway.pid'];
                for (const name of removable) {
                    const target = path.join(CONFIG_DIR, name);
                    if (fs.existsSync(target)) {
                        fs.rmSync(target, { recursive: true, force: true });
                        console.log(`  ${green}✓${reset} Removed ${name}/`);
                    }
                }
            }

            console.log(`\n  ${green}${bold}✓ CoreBlow uninstalled.${reset}`);
            console.log(`  ${dim}The CLI binary is still installed. Remove with: npm uninstall -g coreblow${reset}\n`);
        });
}
