/**
 * CoreBlow CLI — `coreblow daemon`
 *
 * Gateway service lifecycle management: install as system service,
 * start/stop/restart, and status checks.
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
const red = '\x1b[31m';
const reset = '\x1b[0m';

const PID_FILE = path.join(os.homedir(), '.coreblow', 'gateway.pid');

function readPid(): number | null {
    try {
        const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
        if (Number.isNaN(pid)) return null;
        // Check if process is alive
        try { process.kill(pid, 0); return pid; } catch { return null; }
    } catch { return null; }
}

function isRunning(): boolean { return readPid() !== null; }

export function registerDaemonCommand(parent: Command): void {
    const cmd = parent.command('daemon').description('Gateway service management');

    cmd.command('status').description('Show gateway service status')
        .action(() => {
            const pid = readPid();
            if (pid) {
                console.log(`\n  ${green}●${reset} Gateway is ${green}running${reset} (PID ${pid})\n`);
            } else {
                console.log(`\n  ${dim}○${reset} Gateway is ${dim}not running${reset}\n`);
                console.log(`  ${dim}Start with: ${cyan}coreblow daemon start${reset}\n`);
            }
        });

    cmd.command('start').description('Start the gateway as a background process')
        .option('--port <port>', 'Override port')
        .action((opts: { port?: string }) => {
            if (isRunning()) {
                console.log(`${yellow}⚠${reset} Gateway already running (PID ${readPid()}).`);
                return;
            }
            try {
                const coreblowBin = path.resolve(process.cwd(), 'coreblow.mjs');
                const portArg = opts.port ? `--port ${opts.port}` : '';
                const cmd = `node "${coreblowBin}" gateway ${portArg}`;

                // Spawn detached
                const { spawn } = require('node:child_process') as typeof import('node:child_process');
                const logFile = path.join(os.homedir(), '.coreblow', 'logs', 'gateway.log');
                fs.mkdirSync(path.dirname(logFile), { recursive: true });
                const out = fs.openSync(logFile, 'a');
                const child = spawn('node', [coreblowBin, 'gateway', ...(opts.port ? ['--port', opts.port] : [])], {
                    detached: true,
                    stdio: ['ignore', out, out],
                });
                child.unref();

                // Write PID
                fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
                fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');

                console.log(`${green}✓${reset} Gateway started in background (PID ${child.pid})`);
                console.log(`${dim}Logs: ${logFile}${reset}`);
            } catch (err) {
                console.error(`${red}✗${reset} Failed to start: ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    cmd.command('stop').description('Stop the running gateway')
        .action(() => {
            const pid = readPid();
            if (!pid) { console.log(`${dim}Gateway is not running.${reset}`); return; }
            try {
                process.kill(pid, 'SIGTERM');
                // Wait briefly then cleanup
                setTimeout(() => {
                    try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
                }, 500);
                console.log(`${green}✓${reset} Sent SIGTERM to PID ${pid}`);
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
            }
        });

    cmd.command('restart').description('Restart the gateway')
        .action(() => {
            const pid = readPid();
            if (pid) {
                try { process.kill(pid, 'SIGTERM'); } catch { /* ok */ }
                try { fs.unlinkSync(PID_FILE); } catch { /* ok */ }
                console.log(`${yellow}⏳${reset} Stopped PID ${pid}, restarting...`);
            }
            // Re-parse to call start
            console.log(`${dim}Run ${cyan}coreblow daemon start${reset}${dim} to start again.${reset}`);
        });

    cmd.command('logs').description('Tail gateway daemon logs')
        .option('-n, --lines <count>', 'Lines to show', '30')
        .action((opts: { lines: string }) => {
            const logFile = path.join(os.homedir(), '.coreblow', 'logs', 'gateway.log');
            if (!fs.existsSync(logFile)) {
                console.log(`${dim}No daemon logs found at ${logFile}${reset}`);
                return;
            }
            const n = parseInt(opts.lines, 10) || 30;
            try {
                const output = execSync(`tail -${n} "${logFile}"`, { encoding: 'utf8' });
                console.log(output);
            } catch {
                const content = fs.readFileSync(logFile, 'utf8');
                const lines = content.split('\n').slice(-n);
                console.log(lines.join('\n'));
            }
        });

    cmd.command('install').description('Install CoreBlow as a system service (macOS/Linux)')
        .action(() => {
            const platform = process.platform;
            if (platform === 'darwin') {
                console.log(`\n  ${bold}macOS LaunchAgent Setup${reset}\n`);
                console.log(`  ${dim}To install as a system service:${reset}`);
                console.log(`  ${cyan}1.${reset} Create ~/Library/LaunchAgents/com.coreblow.gateway.plist`);
                console.log(`  ${cyan}2.${reset} launchctl load ~/Library/LaunchAgents/com.coreblow.gateway.plist\n`);
            } else if (platform === 'linux') {
                console.log(`\n  ${bold}systemd Service Setup${reset}\n`);
                console.log(`  ${dim}To install as a system service:${reset}`);
                console.log(`  ${cyan}1.${reset} Create /etc/systemd/system/coreblow.service`);
                console.log(`  ${cyan}2.${reset} systemctl enable coreblow && systemctl start coreblow\n`);
            } else {
                console.log(`${yellow}⚠${reset} Service installation not supported on ${platform}.`);
            }
        });
}
