/**
 * CoreBlow CLI — `coreblow channels` command
 *
 * Manage channel adapters: list, start, stop, status.
 * Integrates with the gateway's channel manager REST API.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';

// ─── Gateway API Client ─────────────────────────────────────────

async function gatewayFetch(path: string, method = 'GET'): Promise<unknown> {
    const port = process.env.COREBLOW_PORT || '3000';
    const host = process.env.COREBLOW_HOST || '127.0.0.1';
    const url = `http://${host}:${port}${path}`;

    try {
        const res = await fetch(url, { method });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json();
    } catch (err) {
        if (err instanceof TypeError && (err as Error).message.includes('fetch')) {
            throw new Error(`Cannot connect to gateway at ${host}:${port}. Is it running?`);
        }
        throw err;
    }
}

// ─── Status Formatting ──────────────────────────────────────────

interface ChannelState {
    channelId: string;
    running: boolean;
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    restartPending: boolean;
    restartAttempts: number;
    lastStartAt: number | null;
    lastStopAt: number | null;
    lastError: string | null;
}

function formatChannelStatus(state: ChannelState): string {
    if (state.running && state.connected) return `${green}● online${reset}`;
    if (state.running) return `${yellow}◐ starting${reset}`;
    if (state.restartPending) return `${yellow}↻ restarting (${state.restartAttempts})${reset}`;
    if (!state.enabled) return `${dim}○ disabled${reset}`;
    if (!state.configured) return `${dim}○ not configured${reset}`;
    if (state.lastError) return `${red}✗ error${reset}`;
    return `${dim}○ stopped${reset}`;
}

function formatTimestamp(ts: number | null): string {
    if (!ts) return dim + '—' + reset;
    const d = new Date(ts);
    const elapsed = Date.now() - ts;
    if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    return d.toLocaleTimeString();
}

// ─── Command Registration ───────────────────────────────────────

export function registerChannelsCommand(parent: Command): void {
    const cmd = parent
        .command('channels')
        .alias('ch')
        .description('Manage channel adapters (list, start, stop, status)');

    // coreblow channels list
    cmd.command('list')
        .alias('ls')
        .description('List all channel adapters and their status')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            try {
                const data = await gatewayFetch('/api/channels') as { channels: Record<string, ChannelState> };
                const channels = data.channels ?? {};

                if (opts.json) {
                    console.log(JSON.stringify(channels, null, 2));
                    return;
                }

                const entries = Object.values(channels);
                if (entries.length === 0) {
                    console.log(`\n  ${dim}No channel adapters registered.${reset}`);
                    console.log(`  ${dim}Configure channels in ~/.coreblow/coreblow.json${reset}\n`);
                    return;
                }

                console.log(`\n  ${bold}Channel Adapters${reset}\n`);
                const nameWidth = Math.max(...entries.map(e => e.channelId.length), 8);
                for (const ch of entries) {
                    const status = formatChannelStatus(ch);
                    const lastActive = formatTimestamp(ch.lastStartAt ?? ch.lastStopAt);
                    const error = ch.lastError ? `  ${dim}${ch.lastError}${reset}` : '';
                    console.log(`  ${cyan}${ch.channelId.padEnd(nameWidth)}${reset}  ${status}  ${dim}${lastActive}${reset}${error}`);
                }
                console.log();
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    // coreblow channels start <channel>
    cmd.command('start <channel>')
        .description('Start a channel adapter')
        .action(async (channel: string) => {
            try {
                const data = await gatewayFetch(`/api/channels/${channel}/start`, 'POST') as { ok: boolean };
                if (data.ok) {
                    console.log(`${green}✓${reset} Channel ${cyan}${channel}${reset} start requested.`);
                } else {
                    console.log(`${yellow}⚠${reset} Start request returned unexpected response.`);
                }
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    // coreblow channels stop <channel>
    cmd.command('stop <channel>')
        .description('Stop a channel adapter')
        .action(async (channel: string) => {
            try {
                const data = await gatewayFetch(`/api/channels/${channel}/stop`, 'POST') as { ok: boolean };
                if (data.ok) {
                    console.log(`${green}✓${reset} Channel ${cyan}${channel}${reset} stopped.`);
                } else {
                    console.log(`${yellow}⚠${reset} Stop request returned unexpected response.`);
                }
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    // coreblow channels status <channel>
    cmd.command('status <channel>')
        .description('Show detailed status for a channel')
        .action(async (channel: string) => {
            try {
                const data = await gatewayFetch('/api/channels') as { channels: Record<string, ChannelState> };
                const state = data.channels?.[channel];
                if (!state) {
                    console.log(`${yellow}⚠${reset} Channel "${channel}" not found.`);
                    process.exitCode = 1;
                    return;
                }
                console.log(`\n  ${bold}${cyan}${channel}${reset}\n`);
                console.log(`  ${dim}Status:${reset}     ${formatChannelStatus(state)}`);
                console.log(`  ${dim}Enabled:${reset}    ${state.enabled ? 'yes' : 'no'}`);
                console.log(`  ${dim}Configured:${reset} ${state.configured ? 'yes' : 'no'}`);
                console.log(`  ${dim}Connected:${reset}  ${state.connected ? 'yes' : 'no'}`);
                console.log(`  ${dim}Restarts:${reset}   ${state.restartAttempts}`);
                if (state.lastStartAt) {
                    console.log(`  ${dim}Started:${reset}    ${new Date(state.lastStartAt).toISOString()}`);
                }
                if (state.lastError) {
                    console.log(`  ${dim}Error:${reset}      ${red}${state.lastError}${reset}`);
                }
                console.log();
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });
}
