/**
 * CoreBlow CLI — `coreblow sessions` command
 *
 * Manage active chat sessions: list, inspect, delete.
 * Communicates with the running gateway via REST API.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

// ─── Gateway API Client ─────────────────────────────────────────

async function gatewayFetch(path: string, method = 'GET'): Promise<unknown> {
    const port = process.env.COREBLOW_PORT || '3000';
    const host = process.env.COREBLOW_HOST || '127.0.0.1';
    const url = `http://${host}:${port}${path}`;

    const res = await fetch(url, { method });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return res.json();
}

// ─── Command Registration ───────────────────────────────────────

export function registerSessionsCommand(parent: Command): void {
    const cmd = parent
        .command('sessions')
        .description('Manage active chat sessions');

    // coreblow sessions list
    cmd.command('list')
        .alias('ls')
        .description('List all active sessions')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            try {
                const data = await gatewayFetch('/api/sessions') as {
                    sessions?: Array<{ id: string; model?: string; provider?: string; messageCount?: number; createdAt?: string }>;
                };
                const sessions = data.sessions ?? [];

                if (opts.json) {
                    console.log(JSON.stringify(sessions, null, 2));
                    return;
                }

                if (sessions.length === 0) {
                    console.log(`\n  ${dim}No active sessions.${reset}\n`);
                    return;
                }

                console.log(`\n  ${bold}Active Sessions${reset} (${sessions.length})\n`);
                for (const s of sessions) {
                    const modelInfo = s.model ? ` ${dim}[${s.provider ?? '?'}/${s.model}]${reset}` : '';
                    const msgCount = s.messageCount ? ` ${dim}(${s.messageCount} msgs)${reset}` : '';
                    console.log(`  ${cyan}${s.id}${reset}${modelInfo}${msgCount}`);
                }
                console.log();
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    // coreblow sessions delete <id>
    cmd.command('delete <id>')
        .alias('rm')
        .description('Delete a session by ID')
        .action(async (id: string) => {
            try {
                await gatewayFetch(`/api/sessions/${id}`, 'DELETE');
                console.log(`${green}✓${reset} Session ${cyan}${id}${reset} deleted.`);
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    // coreblow sessions clear
    cmd.command('clear')
        .description('Delete all active sessions')
        .action(async () => {
            try {
                const data = await gatewayFetch('/api/sessions') as {
                    sessions?: Array<{ id: string }>;
                };
                const sessions = data.sessions ?? [];
                if (sessions.length === 0) {
                    console.log(`${dim}No sessions to clear.${reset}`);
                    return;
                }

                let cleared = 0;
                for (const s of sessions) {
                    try {
                        await gatewayFetch(`/api/sessions/${s.id}`, 'DELETE');
                        cleared++;
                    } catch {
                        // skip failed deletes
                    }
                }
                console.log(`${green}✓${reset} Cleared ${cleared}/${sessions.length} sessions.`);
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });
}
