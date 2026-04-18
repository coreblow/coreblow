/**
 * CoreBlow CLI — `coreblow version` command
 *
 * Displays version, runtime, and build information.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { VERSION } from '../../version.js';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const orange = '\x1b[38;5;173m';
const reset = '\x1b[0m';

export function registerVersionCommand(parent: Command): void {
    parent
        .command('version')
        .description('Show detailed version and runtime information')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const info = {
                coreblow: VERSION,
                node: process.versions.node,
                v8: process.versions.v8,
                platform: process.platform,
                arch: process.arch,
                pid: process.pid,
                cwd: process.cwd(),
                execPath: process.execPath,
            };

            if (opts.json) {
                console.log(JSON.stringify(info, null, 2));
                return;
            }

            console.log(`\n  ${orange}${bold}🐙 CoreBlow${reset} ${cyan}v${VERSION}${reset}\n`);
            console.log(`  ${dim}Node.js:${reset}   v${info.node}`);
            console.log(`  ${dim}V8:${reset}       ${info.v8}`);
            console.log(`  ${dim}Platform:${reset}  ${info.platform} / ${info.arch}`);
            console.log(`  ${dim}PID:${reset}       ${info.pid}`);
            console.log(`  ${dim}CWD:${reset}       ${info.cwd}`);
            console.log();
        });
}
