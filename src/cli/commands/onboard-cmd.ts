/**
 * CoreBlow — Onboard Command
 *
 * CLI command: `coreblow onboard`
 * Interactive setup wizard for first-time configuration.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m',
    orange: '\x1b[38;5;173m',
};

interface OnboardConfig {
    provider: string;
    apiKey: string;
    model: string;
    port: number;
    agentName: string;
}

async function ask(rl: readline.Interface, question: string, defaultValue?: string): Promise<string> {
    const suffix = defaultValue ? ` ${c.dim}(${defaultValue})${c.reset}` : '';
    return new Promise((resolve) => {
        rl.question(`  ${c.cyan}?${c.reset} ${question}${suffix}: `, (answer) => {
            resolve(answer.trim() || defaultValue || '');
        });
    });
}

async function askSelect(rl: readline.Interface, question: string, options: string[], defaultValue: string): Promise<string> {
    const optStr = options.map(o => o === defaultValue ? `${c.bold}${o}${c.reset}` : o).join(' / ');
    return new Promise((resolve) => {
        rl.question(`  ${c.cyan}?${c.reset} ${question} [${optStr}]: `, (answer) => {
            const val = answer.trim().toLowerCase() || defaultValue;
            if (options.includes(val)) {
                resolve(val);
            } else {
                resolve(defaultValue);
            }
        });
    });
}

async function askPassword(rl: readline.Interface, question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(`  ${c.cyan}?${c.reset} ${question}: `, (answer) => {
            resolve(answer.trim());
        });
    });
}

export function registerOnboardCommand(program: Command): void {
    program
        .command('onboard')
        .description('Interactive setup wizard for CoreBlow')
        .action(async () => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            console.log(`
  ${c.orange}${c.bold}╔══════════════════════════════════════════════════╗${c.reset}
  ${c.orange}${c.bold}║           🐙 CoreBlow Setup Wizard               ║${c.reset}
  ${c.orange}${c.bold}╚══════════════════════════════════════════════════╝${c.reset}
`);

            // ─── Step 1: Provider ───────────────────────────────

            console.log(`  ${c.bold}Step 1/3: AI Provider${c.reset}`);
            console.log(`  ${c.dim}${'─'.repeat(40)}${c.reset}`);

            const provider = await askSelect(
                rl, 'Provider',
                ['openai', 'anthropic', 'google', 'deepseek', 'groq', 'ollama'],
                'openai',
            );

            let apiKey = '';
            if (provider !== 'ollama') {
                // Check env first
                const envMap: Record<string, string> = {
                    openai: 'OPENAI_API_KEY',
                    anthropic: 'ANTHROPIC_API_KEY',
                    google: 'GOOGLE_API_KEY',
                    deepseek: 'DEEPSEEK_API_KEY',
                    groq: 'GROQ_API_KEY',
                };
                const envKey = envMap[provider];
                const envVal = envKey ? process.env[envKey] : null;

                if (envVal) {
                    const masked = envVal.slice(0, 6) + '...' + envVal.slice(-4);
                    console.log(`  ${c.green}✓${c.reset} Found ${envKey}=${c.dim}${masked}${c.reset}`);
                    apiKey = envVal;
                } else {
                    apiKey = await askPassword(rl, 'API Key');
                    if (!apiKey) {
                        console.log(`  ${c.red}✗ API key is required${c.reset}`);
                        rl.close();
                        process.exit(1);
                    }
                }
            }

            const defaultModels: Record<string, string> = {
                openai: 'gpt-4o',
                anthropic: 'claude-sonnet-4-20250514',
                google: 'gemini-2.5-flash',
                deepseek: 'deepseek-chat',
                groq: 'llama-3.3-70b-versatile',
                ollama: 'llama3.2',
            };

            const model = await ask(rl, 'Model', defaultModels[provider] ?? 'gpt-4o');

            console.log(`  ${c.green}✓${c.reset} Provider configured!\n`);

            // ─── Step 2: Server ─────────────────────────────────

            console.log(`  ${c.bold}Step 2/3: Server Configuration${c.reset}`);
            console.log(`  ${c.dim}${'─'.repeat(40)}${c.reset}`);

            const portStr = await ask(rl, 'Port', '3000');
            const port = parseInt(portStr, 10) || 3000;

            console.log(`  ${c.green}✓${c.reset} Server configured!\n`);

            // ─── Step 3: Agent ──────────────────────────────────

            console.log(`  ${c.bold}Step 3/3: Agent Identity${c.reset}`);
            console.log(`  ${c.dim}${'─'.repeat(40)}${c.reset}`);

            const agentName = await ask(rl, 'Agent name', 'CoreBlow');

            console.log(`  ${c.green}✓${c.reset} Agent configured!\n`);

            rl.close();

            // ─── Generate Config ────────────────────────────────

            const configDir = process.env.COREBLOW_CONFIG_DIR ?? path.join(os.homedir(), '.coreblow');
            const configPath = path.join(configDir, 'coreblow.json');

            // OpenClaw-compatible config format
            const modelRef = provider === 'ollama' ? `ollama/${model}` : `${provider}/${model}`;
            const config: Record<string, unknown> = {
                agents: {
                    defaults: {
                        model: modelRef,
                    },
                },
                gateway: {
                    mode: 'local',
                    bind: 'lan',
                },
            };

            // Create directory
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            // Backup existing config
            if (fs.existsSync(configPath)) {
                const backupPath = configPath + '.backup.' + Date.now();
                fs.copyFileSync(configPath, backupPath);
                console.log(`  ${c.dim}Backed up existing config to ${path.basename(backupPath)}${c.reset}`);
            }

            // Write config
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

            // Write API key hint
            if (apiKey && provider !== 'ollama') {
                const envMap: Record<string, string> = {
                    openai: 'OPENAI_API_KEY',
                    anthropic: 'ANTHROPIC_API_KEY',
                    google: 'GOOGLE_API_KEY',
                    deepseek: 'DEEPSEEK_API_KEY',
                    groq: 'GROQ_API_KEY',
                };
                const envVar = envMap[provider] ?? `${provider.toUpperCase()}_API_KEY`;

                // Write to .env for convenience
                const envPath = path.join(configDir, '.env');
                const envLine = `${envVar}=${apiKey}\n`;
                fs.appendFileSync(envPath, envLine, 'utf8');
            }

            console.log(`  ${c.orange}${c.bold}${'═'.repeat(46)}${c.reset}`);
            console.log(`  ${c.green}✓${c.reset} Configuration written to ${c.cyan}${configPath}${c.reset}`);
            console.log(`  ${c.green}✓${c.reset} Provider: ${c.bold}${provider}${c.reset} / ${model}`);
            console.log(`  ${c.green}✓${c.reset} Agent: ${c.bold}${agentName}${c.reset}`);
            console.log(`  ${c.orange}${c.bold}${'═'.repeat(46)}${c.reset}`);
            console.log();
            console.log(`  ${c.bold}Next steps:${c.reset}`);
            console.log(`  ${c.cyan}1.${c.reset} coreblow gateway        ${c.dim}— start the gateway${c.reset}`);
            console.log(`  ${c.cyan}2.${c.reset} coreblow chat            ${c.dim}— start chatting${c.reset}`);
            console.log(`  ${c.cyan}3.${c.reset} coreblow status          ${c.dim}— check status${c.reset}`);
            console.log();
        });
}
