/**
 * CoreBlow CLI — `coreblow webhooks`
 *
 * Manage webhooks via CLI. Lists, registers, removes, and tests webhooks
 * through the gateway REST API.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as crypto from 'node:crypto';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const reset = '\x1b[0m';

function gwUrl(path: string): string {
    const port = process.env.COREBLOW_PORT || '3000';
    const host = process.env.COREBLOW_HOST || '127.0.0.1';
    return `http://${host}:${port}${path}`;
}

export function registerWebhooksCommand(parent: Command): void {
    const cmd = parent.command('webhooks').alias('wh').description('Manage webhook integrations');

    cmd.command('list').alias('ls').description('List registered webhooks')
        .option('--json', 'Output as JSON')
        .action(async (opts: { json?: boolean }) => {
            try {
                const res = await fetch(gwUrl('/api/webhooks'));
                const data = await res.json() as { webhooks: Array<{ id: string; name: string; outboundUrl: string }> };
                if (opts.json) { console.log(JSON.stringify(data.webhooks, null, 2)); return; }
                console.log(`\n  ${bold}Webhooks${reset} (${data.webhooks.length})\n`);
                if (data.webhooks.length === 0) { console.log(`  ${dim}No webhooks registered.${reset}\n`); return; }
                for (const w of data.webhooks) {
                    console.log(`  ${cyan}${w.id}${reset}  ${w.name}  ${dim}→ ${w.outboundUrl}${reset}`);
                }
                console.log();
            } catch (err) { console.error(`${red}✗${reset} ${(err as Error).message}`); process.exitCode = 1; }
        });

    cmd.command('add <name> <url>').description('Register a new webhook')
        .option('--id <id>', 'Custom webhook ID')
        .option('--secret <secret>', 'Webhook secret for signature verification')
        .action(async (name: string, outboundUrl: string, opts: { id?: string; secret?: string }) => {
            const id = opts.id ?? `wh-${crypto.randomBytes(4).toString('hex')}`;
            try {
                const res = await fetch(gwUrl('/api/webhooks'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, name, outboundUrl, secret: opts.secret }),
                });
                if (res.ok) { console.log(`${green}✓${reset} Webhook ${cyan}${id}${reset} registered (${name})`); }
                else { const err = await res.json(); console.error(`${red}✗${reset} ${JSON.stringify(err)}`); }
            } catch (err) { console.error(`${red}✗${reset} ${(err as Error).message}`); process.exitCode = 1; }
        });

    cmd.command('remove <id>').alias('rm').description('Remove a webhook')
        .action(async (id: string) => {
            try {
                const res = await fetch(gwUrl(`/api/webhooks/${id}`), { method: 'DELETE' });
                if (res.ok) { console.log(`${green}✓${reset} Removed webhook ${cyan}${id}${reset}`); }
                else { console.error(`${red}✗${reset} Webhook "${id}" not found.`); process.exitCode = 1; }
            } catch (err) { console.error(`${red}✗${reset} ${(err as Error).message}`); process.exitCode = 1; }
        });

    cmd.command('test <id>').description('Send a test payload to a webhook')
        .option('--message <msg>', 'Custom test message', 'CoreBlow webhook test')
        .action(async (id: string, opts: { message: string }) => {
            try {
                const res = await fetch(gwUrl(`/webhook/${id}`), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: opts.message, sender: 'cli-test', timestamp: Date.now() }),
                });
                const data = await res.json();
                if (res.ok) { console.log(`${green}✓${reset} Test sent to ${cyan}${id}${reset}`); }
                else { console.error(`${yellow}⚠${reset} ${JSON.stringify(data)}`); }
            } catch (err) { console.error(`${red}✗${reset} ${(err as Error).message}`); process.exitCode = 1; }
        });
}
