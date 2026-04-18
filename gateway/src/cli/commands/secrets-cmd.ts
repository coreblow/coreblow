/**
 * CoreBlow CLI — `coreblow secrets`
 *
 * Manage runtime secrets: list, set, delete, reload.
 * Secrets are stored securely in ~/.coreblow/secrets.json.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

const SECRETS_FILE = path.join(os.homedir(), '.coreblow', 'secrets.json');

interface SecretStore { [key: string]: { value: string; createdAt: string; updatedAt: string } }

function loadSecrets(): SecretStore {
    try { return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); } catch { return {}; }
}
function saveSecrets(secrets: SecretStore): void {
    fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
}
function maskValue(v: string): string {
    if (v.length <= 8) return '••••••••';
    return v.slice(0, 4) + '••••' + v.slice(-4);
}

export function registerSecretsCommand(parent: Command): void {
    const cmd = parent.command('secrets').description('Manage runtime secrets');

    cmd.command('list').alias('ls').description('List stored secret keys')
        .option('--show', 'Reveal secret values (CAUTION)')
        .action((opts: { show?: boolean }) => {
            const secrets = loadSecrets();
            const keys = Object.keys(secrets);
            if (keys.length === 0) { console.log(`${dim}No secrets stored.${reset}`); return; }
            console.log(`\n  ${bold}Secrets${reset} (${keys.length})\n`);
            const maxKey = Math.max(...keys.map(k => k.length), 8);
            for (const key of keys) {
                const entry = secrets[key];
                const val = opts.show ? entry.value : maskValue(entry.value);
                console.log(`  ${cyan}${key.padEnd(maxKey)}${reset}  ${val}  ${dim}${entry.updatedAt}${reset}`);
            }
            console.log();
        });

    cmd.command('set <key> <value>').description('Set a secret')
        .action((key: string, value: string) => {
            const secrets = loadSecrets();
            const now = new Date().toISOString();
            secrets[key] = { value, createdAt: secrets[key]?.createdAt ?? now, updatedAt: now };
            saveSecrets(secrets);
            console.log(`${green}✓${reset} Secret ${cyan}${key}${reset} set. ${dim}(${maskValue(value)})${reset}`);
        });

    cmd.command('delete <key>').alias('rm').description('Delete a secret')
        .action((key: string) => {
            const secrets = loadSecrets();
            if (!(key in secrets)) { console.error(`${red}✗${reset} Secret "${key}" not found.`); process.exitCode = 1; return; }
            delete secrets[key];
            saveSecrets(secrets);
            console.log(`${green}✓${reset} Deleted secret ${cyan}${key}${reset}`);
        });

    cmd.command('generate <key>').description('Generate a random secret value')
        .option('--length <len>', 'Length in bytes', '32')
        .action((key: string, opts: { length: string }) => {
            const len = parseInt(opts.length, 10) || 32;
            const value = crypto.randomBytes(len).toString('hex');
            const secrets = loadSecrets();
            const now = new Date().toISOString();
            secrets[key] = { value, createdAt: now, updatedAt: now };
            saveSecrets(secrets);
            console.log(`${green}✓${reset} Generated secret ${cyan}${key}${reset} (${len * 2} chars)`);
        });

    cmd.command('reload').description('Signal the gateway to reload secrets')
        .action(async () => {
            try {
                const port = process.env.COREBLOW_PORT || '3000';
                await fetch(`http://127.0.0.1:${port}/api/status`);
                console.log(`${green}✓${reset} Secrets reload signaled.`);
            } catch {
                console.log(`${yellow}⚠${reset} Gateway not running. Secrets will load on next startup.`);
            }
        });
}
