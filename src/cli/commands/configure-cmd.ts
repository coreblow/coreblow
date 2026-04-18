/**
 * CoreBlow CLI — `coreblow configure`
 *
 * Interactive configuration wizard for credentials, channels,
 * gateway settings, and agent defaults. Guides the user through
 * provider selection and API key entry.
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

const CONFIG_FILE = path.join(os.homedir(), '.coreblow', 'coreblow.json');

function loadConfig(): Record<string, unknown> {
    try {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch { return {}; }
}

function saveConfig(config: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

function prompt(rl: readline.Interface, question: string, defaultVal?: string): Promise<string> {
    const suffix = defaultVal ? ` ${dim}(${defaultVal})${reset}` : '';
    return new Promise((resolve) => {
        rl.question(`  ${question}${suffix}: `, (answer) => {
            resolve(answer.trim() || defaultVal || '');
        });
    });
}

function promptSelect(rl: readline.Interface, question: string, options: string[]): Promise<string> {
    return new Promise((resolve) => {
        console.log(`  ${question}`);
        options.forEach((opt, i) => console.log(`    ${cyan}${i + 1}${reset}. ${opt}`));
        rl.question(`  ${dim}Select (1-${options.length}):${reset} `, (answer) => {
            const idx = parseInt(answer, 10) - 1;
            resolve(options[idx] ?? options[0]);
        });
    });
}

const PROVIDER_MODELS: Record<string, string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
    anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022'],
    google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    ollama: ['llama3.3:latest', 'qwen2.5:latest'],
};

export function registerConfigureCommand(parent: Command): void {
    parent
        .command('configure')
        .description('Interactive configuration for credentials, channels, and gateway')
        .option('--provider-only', 'Only configure AI provider')
        .option('--gateway-only', 'Only configure gateway settings')
        .option('--channels-only', 'Only configure channels')
        .action(async (opts: { providerOnly?: boolean; gatewayOnly?: boolean; channelsOnly?: boolean }) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const config = loadConfig();

            console.log(`\n  ${orange}${bold}🐙 CoreBlow Configuration Wizard${reset}\n`);

            const doAll = !opts.providerOnly && !opts.gatewayOnly && !opts.channelsOnly;

            try {
                // ── Provider Configuration ───────────────────────
                if (doAll || opts.providerOnly) {
                    console.log(`  ${bold}Step 1: AI Provider${reset}\n`);

                    const providers = Object.keys(PROVIDER_MODELS);
                    const currentProvider = (config.provider as string) || '';
                    const provider = await promptSelect(rl, 'Select your AI provider:', providers);

                    config.provider = provider;

                    // API key (skip for ollama)
                    if (provider !== 'ollama') {
                        const existingKey = ((config.providers as Record<string, Record<string, string>>)?.[provider])?.apiKey;
                        const hasKey = !!existingKey;
                        if (hasKey) {
                            console.log(`  ${green}✓${reset} API key already set for ${cyan}${provider}${reset}`);
                            const change = await prompt(rl, 'Change it? (y/N)', 'N');
                            if (change.toLowerCase() === 'y') {
                                const key = await prompt(rl, `Enter ${provider} API key`);
                                if (key) {
                                    if (!config.providers || typeof config.providers !== 'object') config.providers = {};
                                    if (!(config.providers as Record<string, unknown>)[provider]) {
                                        (config.providers as Record<string, unknown>)[provider] = {};
                                    }
                                    ((config.providers as Record<string, Record<string, string>>)[provider]).apiKey = key;
                                }
                            }
                        } else {
                            const key = await prompt(rl, `Enter ${provider} API key`);
                            if (key) {
                                if (!config.providers || typeof config.providers !== 'object') config.providers = {};
                                if (!(config.providers as Record<string, unknown>)[provider]) {
                                    (config.providers as Record<string, unknown>)[provider] = {};
                                }
                                ((config.providers as Record<string, Record<string, string>>)[provider]).apiKey = key;
                            }
                        }
                    }

                    // Model selection
                    const models = PROVIDER_MODELS[provider] ?? [];
                    if (models.length > 0) {
                        const model = await promptSelect(rl, `Select ${provider} model:`, models);
                        config.model = model;
                    }

                    console.log();
                }

                // ── Gateway Configuration ────────────────────────
                if (doAll || opts.gatewayOnly) {
                    console.log(`  ${bold}Step 2: Gateway Settings${reset}\n`);

                    const gw = (config.gateway ?? {}) as Record<string, unknown>;
                    const port = await prompt(rl, 'Gateway port', String(gw.port ?? 3000));
                    const host = await prompt(rl, 'Gateway host', String(gw.host ?? '0.0.0.0'));

                    config.gateway = { ...gw, port: parseInt(port, 10) || 3000, host };
                    console.log();
                }

                // ── Channel Configuration ────────────────────────
                if (doAll || opts.channelsOnly) {
                    console.log(`  ${bold}Step 3: Channels${reset}\n`);

                    const channelList = ['discord', 'telegram', 'slack', 'whatsapp', 'webchat'];
                    console.log(`  ${dim}Available channels: ${channelList.join(', ')}${reset}`);
                    const selected = await prompt(rl, 'Enable channels (comma-separated)', 'webchat');
                    const enabled = selected.split(',').map(s => s.trim()).filter(Boolean);

                    if (!config.channels || typeof config.channels !== 'object') config.channels = {};
                    for (const ch of enabled) {
                        if (!(config.channels as Record<string, unknown>)[ch]) {
                            (config.channels as Record<string, unknown>)[ch] = { enabled: true };
                        } else {
                            ((config.channels as Record<string, Record<string, unknown>>)[ch]).enabled = true;
                        }
                    }

                    if (enabled.includes('telegram')) {
                        const token = await prompt(rl, 'Telegram bot token');
                        if (token) {
                            ((config.channels as Record<string, Record<string, string>>).telegram).token = token;
                        }
                    }

                    if (enabled.includes('discord')) {
                        const token = await prompt(rl, 'Discord bot token');
                        if (token) {
                            ((config.channels as Record<string, Record<string, string>>).discord).token = token;
                        }
                    }
                    console.log();
                }

                // ── Save ─────────────────────────────────────────
                saveConfig(config);
                console.log(`  ${green}${bold}✓ Configuration saved!${reset}`);
                console.log(`  ${dim}Config: ${CONFIG_FILE}${reset}`);
                console.log(`  ${dim}Run ${cyan}coreblow gateway${reset}${dim} to start.${reset}\n`);

            } finally {
                rl.close();
            }
        });
}
