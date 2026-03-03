/**
 * CoreBlow CLI — `coreblow message`
 *
 * Send, broadcast, and list messages across channels.
 * Communicates with the running gateway via REST API.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

async function gatewayPost(path: string, body: unknown, port = '3000', host = '127.0.0.1'): Promise<unknown> {
    const res = await fetch(`http://${host}:${port}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    return res.json();
}

async function gatewayGet(path: string, port = '3000', host = '127.0.0.1'): Promise<unknown> {
    const res = await fetch(`http://${host}:${port}${path}`);
    return res.json();
}

export function registerMessageCommand(parent: Command): void {
    const cmd = parent
        .command('message')
        .alias('msg')
        .description('Send, read, and manage messages');

    cmd.command('send <channel> <text...>')
        .description('Send a message to a specific channel')
        .option('--to <target>', 'Target chat/user ID')
        .action(async (channel: string, textParts: string[], opts: { to?: string }) => {
            const text = textParts.join(' ');
            try {
                const result = await gatewayPost('/api/chat', {
                    message: text,
                    channel,
                    target: opts.to,
                });
                console.log(`${green}✓${reset} Message sent to ${cyan}${channel}${reset}`);
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    cmd.command('broadcast <text...>')
        .description('Broadcast a message to all active channels')
        .action(async (textParts: string[]) => {
            const text = textParts.join(' ');
            try {
                const result = await gatewayPost('/api/events/broadcast', {
                    channel: 'default',
                    event: 'message',
                    data: { text },
                });
                console.log(`${green}✓${reset} Broadcast sent`);
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    cmd.command('list')
        .alias('ls')
        .description('List recent message activity')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            try {
                const data = await gatewayGet('/api/sessions');
                if (opts.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else {
                    console.log(`\n  ${bold}Recent Activity${reset}\n`);
                    const sessions = (data as { sessions?: Array<{ id: string }> }).sessions ?? [];
                    if (sessions.length === 0) {
                        console.log(`  ${dim}No recent activity.${reset}\n`);
                    } else {
                        for (const s of sessions) {
                            console.log(`  ${cyan}${s.id}${reset}`);
                        }
                        console.log();
                    }
                }
            } catch (err) {
                console.error(`${red}✗${reset} ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });
}
