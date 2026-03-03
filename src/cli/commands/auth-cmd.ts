/**
 * CoreBlow CLI — `coreblow auth` command
 *
 * Set up API keys for AI providers. Reads/writes to the secure
 * auth store at ~/.coreblow/coreblow.json.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as readline from 'node:readline';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const orange = '\x1b[38;5;173m';
const reset = '\x1b[0m';

// ─── Config Helpers ──────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');

function loadConfig(): Record<string, unknown> {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as Record<string, unknown>;
    } catch {
        return {};
    }
}

function saveConfig(config: Record<string, unknown>): void {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// ─── Known Providers ─────────────────────────────────────────────

interface ProviderMeta {
    id: string;
    name: string;
    envKey: string;
    configPath: string;
    docsUrl: string;
    keyPrefix?: string;
}

const PROVIDERS: ProviderMeta[] = [
    { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY', configPath: 'providers.openai.apiKey', docsUrl: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-' },
    { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', configPath: 'providers.anthropic.apiKey', docsUrl: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-' },
    { id: 'google', name: 'Google AI (Gemini)', envKey: 'GOOGLE_API_KEY', configPath: 'providers.google.apiKey', docsUrl: 'https://aistudio.google.com/apikey', keyPrefix: 'AIza' },
    { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', configPath: 'providers.deepseek.apiKey', docsUrl: 'https://platform.deepseek.com/api-keys', keyPrefix: 'sk-' },
    { id: 'mistral', name: 'Mistral AI', envKey: 'MISTRAL_API_KEY', configPath: 'providers.mistral.apiKey', docsUrl: 'https://console.mistral.ai/api-keys' },
];

// ─── Helpers ─────────────────────────────────────────────────────

function maskKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 6) + '••••' + key.slice(-4);
}

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
    const segs = keyPath.split('.');
    let cur: unknown = obj;
    for (const s of segs) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[s];
    }
    return cur;
}

function setNestedValue(obj: Record<string, unknown>, keyPath: string, val: unknown): void {
    const segs = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < segs.length - 1; i++) {
        if (typeof cur[segs[i]] !== 'object' || cur[segs[i]] === null) {
            cur[segs[i]] = {};
        }
        cur = cur[segs[i]] as Record<string, unknown>;
    }
    cur[segs[segs.length - 1]] = val;
}

async function promptSecret(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        // Start with hidden input
        process.stdout.write(question);
        let input = '';

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.resume();

        const onData = (data: Buffer) => {
            const char = data.toString();
            if (char === '\n' || char === '\r') {
                process.stdin.removeListener('data', onData);
                if (process.stdin.isTTY) {
                    process.stdin.setRawMode(false);
                }
                process.stdout.write('\n');
                rl.close();
                resolve(input.trim());
            } else if (char === '\x7f' || char === '\b') {
                // Backspace
                if (input.length > 0) {
                    input = input.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            } else if (char === '\x03') {
                // Ctrl+C
                process.stdout.write('\n');
                rl.close();
                process.exit(0);
            } else {
                input += char;
                process.stdout.write('•');
            }
        };

        process.stdin.on('data', onData);
    });
}

// ─── Command Registration ───────────────────────────────────────

export function registerAuthCommand(parent: Command): void {
    const cmd = parent
        .command('auth')
        .description('Manage API key authentication for AI providers');

    // coreblow auth status — show which providers are configured
    cmd.command('status')
        .description('Show authentication status for all providers')
        .action(() => {
            const config = loadConfig();

            console.log(`\n  ${bold}Provider Authentication Status${reset}\n`);

            for (const p of PROVIDERS) {
                const configKey = getNestedValue(config, p.configPath) as string | undefined;
                const envKey = process.env[p.envKey];
                const key = configKey || envKey;

                let status: string;
                let source: string;
                if (configKey) {
                    status = `${green}✓ configured${reset}`;
                    source = `${dim}(config: ${maskKey(configKey)})${reset}`;
                } else if (envKey) {
                    status = `${green}✓ env${reset}`;
                    source = `${dim}(env: ${p.envKey})${reset}`;
                } else {
                    status = `${dim}○ not set${reset}`;
                    source = '';
                }

                console.log(`  ${cyan}${p.name.padEnd(22)}${reset} ${status} ${source}`);
            }
            console.log();
        });

    // coreblow auth set <provider> [key] — set API key
    cmd.command('set <provider> [key]')
        .description('Set an API key for a provider (prompted if key not given)')
        .action(async (providerId: string, key?: string) => {
            const provider = PROVIDERS.find(p => p.id === providerId);
            if (!provider) {
                console.error(`${red}✗${reset} Unknown provider "${providerId}".`);
                console.log(`${dim}Available: ${PROVIDERS.map(p => p.id).join(', ')}${reset}`);
                process.exitCode = 1;
                return;
            }

            // Prompt for key if not provided
            let apiKey = key;
            if (!apiKey) {
                console.log(`\n  ${bold}${provider.name}${reset}`);
                console.log(`  ${dim}Get your key at: ${provider.docsUrl}${reset}\n`);
                apiKey = await promptSecret(`  Enter API key: `);
            }

            if (!apiKey || apiKey.trim().length === 0) {
                console.log(`${yellow}⚠${reset} No key provided, aborted.`);
                return;
            }

            // Basic validation
            if (provider.keyPrefix && !apiKey.startsWith(provider.keyPrefix)) {
                console.log(`${yellow}⚠${reset} Key doesn't start with expected prefix "${provider.keyPrefix}". Saving anyway.`);
            }

            const config = loadConfig();
            setNestedValue(config, provider.configPath, apiKey);

            // Set as active provider if no active provider is set
            if (!config.provider && !config.activeProvider) {
                config.provider = provider.id;
            }

            saveConfig(config);
            console.log(`${green}✓${reset} Saved ${cyan}${provider.name}${reset} API key. ${dim}(${maskKey(apiKey)})${reset}`);
        });

    // coreblow auth remove <provider> — remove API key
    cmd.command('remove <provider>')
        .alias('rm')
        .description('Remove a stored API key for a provider')
        .action((providerId: string) => {
            const provider = PROVIDERS.find(p => p.id === providerId);
            if (!provider) {
                console.error(`${red}✗${reset} Unknown provider "${providerId}".`);
                process.exitCode = 1;
                return;
            }

            const config = loadConfig();
            const existing = getNestedValue(config, provider.configPath);
            if (!existing) {
                console.log(`${dim}No key stored for ${provider.name}.${reset}`);
                return;
            }

            // Delete the key
            const segments = provider.configPath.split('.');
            let current: unknown = config;
            for (let i = 0; i < segments.length - 1; i++) {
                if (!current || typeof current !== 'object') return;
                current = (current as Record<string, unknown>)[segments[i]];
            }
            if (current && typeof current === 'object') {
                delete (current as Record<string, unknown>)[segments[segments.length - 1]];
            }

            saveConfig(config);
            console.log(`${green}✓${reset} Removed ${cyan}${provider.name}${reset} API key.`);
        });

    // Default: show status
    cmd.action(() => {
        cmd.commands.find(c => c.name() === 'status')?.parse(process.argv);
    });
}
