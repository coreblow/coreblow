/**
 * CoreBlow CLI — `coreblow dashboard`
 *
 * Open the CoreBlow Control UI in the default browser.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

function resolvePort(): number {
    try {
        const cfgPath = path.join(os.homedir(), '.coreblow', 'coreblow.json');
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        return (cfg.gateway?.port as number) ?? 3000;
    } catch { return 3000; }
}

function openBrowser(url: string): boolean {
    try {
        const platform = process.platform;
        if (platform === 'darwin') { execSync(`open "${url}"`); return true; }
        if (platform === 'linux') { execSync(`xdg-open "${url}"`); return true; }
        if (platform === 'win32') { execSync(`start "${url}"`); return true; }
        return false;
    } catch { return false; }
}

export function registerDashboardCommand(parent: Command): void {
    parent
        .command('dashboard')
        .description('Open the CoreBlow Control UI in your browser')
        .option('--port <port>', 'Gateway port')
        .option('--no-open', 'Print URL without opening browser')
        .action((opts: { port?: string; open?: boolean }) => {
            const port = opts.port ? parseInt(opts.port, 10) : resolvePort();
            const url = `http://127.0.0.1:${port}/`;

            if (opts.open === false) {
                console.log(url);
                return;
            }

            console.log(`\n  ${green}●${reset} Opening CoreBlow Dashboard at ${cyan}${url}${reset}\n`);

            if (!openBrowser(url)) {
                console.log(`  ${yellow}⚠${reset} Could not open browser. Visit manually:`);
                console.log(`  ${bold}${url}${reset}\n`);
            }
        });
}
