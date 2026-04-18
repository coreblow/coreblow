/**
 * CoreBlow CLI — `coreblow reset`
 *
 * Reset local config/state. Optionally clears sessions, logs,
 * or everything. Requires --confirm for destructive operations.
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
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');

function removeDir(dirPath: string): number {
    if (!fs.existsSync(dirPath)) return 0;
    let count = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            count += removeDir(full);
            fs.rmdirSync(full);
        } else {
            fs.unlinkSync(full);
            count++;
        }
    }
    return count;
}

export function registerResetCommand(parent: Command): void {
    parent
        .command('reset')
        .description('Reset local config/state (keeps the CLI installed)')
        .option('--confirm', 'Required flag to confirm destructive reset')
        .option('--config-only', 'Only reset config file to defaults')
        .option('--logs-only', 'Only clear log files')
        .option('--sessions-only', 'Only clear stored sessions')
        .option('--all', 'Clear everything in ~/.coreblow/')
        .action((opts: { confirm?: boolean; configOnly?: boolean; logsOnly?: boolean; sessionsOnly?: boolean; all?: boolean }) => {
            if (!opts.confirm) {
                console.log(`\n  ${yellow}⚠${reset} This command will permanently delete CoreBlow data.`);
                console.log(`  ${dim}Add ${bold}--confirm${reset}${dim} to proceed.${reset}\n`);
                console.log(`  ${dim}Options:${reset}`);
                console.log(`    ${cyan}--config-only${reset}    Reset config to defaults`);
                console.log(`    ${cyan}--logs-only${reset}      Clear log files`);
                console.log(`    ${cyan}--sessions-only${reset}  Clear stored sessions`);
                console.log(`    ${cyan}--all${reset}            Clear everything\n`);
                process.exitCode = 1;
                return;
            }

            console.log(`\n  ${orange}${bold}🐙 CoreBlow Reset${reset}\n`);

            if (opts.all) {
                // Delete everything
                if (fs.existsSync(CONFIG_DIR)) {
                    const count = removeDir(CONFIG_DIR);
                    console.log(`  ${green}✓${reset} Cleared ${count} files from ${dim}${CONFIG_DIR}${reset}`);
                } else {
                    console.log(`  ${dim}Nothing to reset.${reset}`);
                }
                console.log(`\n  ${dim}Run ${cyan}coreblow setup${reset}${dim} to reinitialize.${reset}\n`);
                return;
            }

            if (opts.configOnly || (!opts.logsOnly && !opts.sessionsOnly)) {
                // Reset config to defaults
                const defaultConfig = {
                    $schema: 'https://coreblow.com/schema/config.json',
                    version: 1,
                    provider: '',
                    model: '',
                    gateway: { port: 3000, host: '0.0.0.0' },
                    providers: {},
                    channels: {},
                };
                fs.mkdirSync(CONFIG_DIR, { recursive: true });
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf8');
                console.log(`  ${green}✓${reset} Config reset to defaults`);
            }

            if (opts.logsOnly || opts.all) {
                const logsDir = path.join(CONFIG_DIR, 'logs');
                if (fs.existsSync(logsDir)) {
                    const count = removeDir(logsDir);
                    console.log(`  ${green}✓${reset} Cleared ${count} log files`);
                }
            }

            if (opts.sessionsOnly || opts.all) {
                const sessionsDir = path.join(CONFIG_DIR, 'sessions');
                if (fs.existsSync(sessionsDir)) {
                    const count = removeDir(sessionsDir);
                    console.log(`  ${green}✓${reset} Cleared ${count} session files`);
                }
            }

            console.log();
        });
}

const orange = '\x1b[38;5;173m';
