/**
 * CoreBlow CLI — `coreblow tui`
 *
 * Terminal User Interface for interactive gateway management.
 * Provides a split-pane view with channels, sessions, and live chat.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as readline from 'node:readline';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const orange = '\x1b[38;5;173m';
const reset = '\x1b[0m';
const clear = '\x1b[2J\x1b[H';

async function fetchStatus(port: string, host: string): Promise<Record<string, unknown> | null> {
    try {
        const res = await fetch(`http://${host}:${port}/api/status`);
        return await res.json() as Record<string, unknown>;
    } catch { return null; }
}

function drawHeader(): void {
    process.stdout.write(`${orange}${bold} 🐙 CoreBlow TUI ${reset}${dim} — press 'q' to quit, 'r' to refresh${reset}\n`);
    process.stdout.write(`${'─'.repeat(60)}\n`);
}

function drawStatus(status: Record<string, unknown>): void {
    const version = status.version ?? '?';
    const provider = status.provider ?? 'none';
    const model = status.model ?? 'none';
    const uptime = typeof status.uptime === 'number' ? `${Math.floor(status.uptime)}s` : '?';

    process.stdout.write(`\n  ${bold}Gateway${reset}\n`);
    process.stdout.write(`  ${dim}Version:${reset}  ${version}\n`);
    process.stdout.write(`  ${dim}Provider:${reset} ${provider}\n`);
    process.stdout.write(`  ${dim}Model:${reset}    ${model}\n`);
    process.stdout.write(`  ${dim}Uptime:${reset}   ${uptime}\n`);

    // SSE
    const sse = status.sse as Record<string, unknown> | undefined;
    if (sse) {
        process.stdout.write(`\n  ${bold}SSE${reset}\n`);
        process.stdout.write(`  ${dim}Clients:${reset}  ${sse.clients ?? 0}\n`);
        process.stdout.write(`  ${dim}Channels:${reset} ${sse.channels ?? 0}\n`);
    }

    // WebSocket
    const ws = status.websocket as Record<string, unknown> | undefined;
    if (ws) {
        process.stdout.write(`\n  ${bold}WebSocket${reset}\n`);
        process.stdout.write(`  ${dim}Clients:${reset}  ${ws.clients ?? 0}\n`);
    }

    // Channels
    const channels = status.channelStates as Record<string, Record<string, unknown>> | undefined;
    if (channels && Object.keys(channels).length > 0) {
        process.stdout.write(`\n  ${bold}Channels${reset}\n`);
        for (const [id, ch] of Object.entries(channels)) {
            const running = ch.running ? `${green}●${reset}` : `${dim}○${reset}`;
            process.stdout.write(`  ${running} ${cyan}${id}${reset}\n`);
        }
    }
}

export function registerTuiCommand(parent: Command): void {
    parent
        .command('tui')
        .description('Open a terminal UI connected to the Gateway')
        .option('--port <port>', 'Gateway port', '3000')
        .option('--host <host>', 'Gateway host', '127.0.0.1')
        .option('--interval <ms>', 'Refresh interval in ms', '3000')
        .action(async (opts: { port: string; host: string; interval: string }) => {
            const interval = parseInt(opts.interval, 10) || 3000;

            // Set up raw mode for key input
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(true);
            }
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            let running = true;

            const refresh = async () => {
                process.stdout.write(clear);
                drawHeader();

                const status = await fetchStatus(opts.port, opts.host);
                if (status) {
                    drawStatus(status);
                } else {
                    process.stdout.write(`\n  ${red}✗${reset} Cannot connect to gateway at ${opts.host}:${opts.port}\n`);
                    process.stdout.write(`  ${dim}Is it running? Start with: ${cyan}coreblow gateway${reset}\n`);
                }

                process.stdout.write(`\n${'─'.repeat(60)}\n`);
                process.stdout.write(`${dim}Last refresh: ${new Date().toLocaleTimeString()}${reset}\n`);
            };

            await refresh();

            const timer = setInterval(() => {
                if (running) void refresh();
            }, interval);

            process.stdin.on('data', (key: string) => {
                if (key === 'q' || key === '\x03') {
                    running = false;
                    clearInterval(timer);
                    if (process.stdin.isTTY) process.stdin.setRawMode(false);
                    process.stdout.write(clear);
                    console.log(`${dim}TUI closed.${reset}`);
                    process.exit(0);
                } else if (key === 'r') {
                    void refresh();
                }
            });
        });
}
