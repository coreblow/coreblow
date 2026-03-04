/**
 * src/cli/onboard.ts
 * Interactive onboarding wizard — first-time setup
 */

import fs from 'node:fs';
import readline from 'node:readline';
import { getHomeDir, getConfigPath, loadConfig, type GatewayConfig } from '../gateway/config.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('onboard');

export async function onboardCommand() {
    console.log('');
    console.log('🤖 Welcome to CoreBlow Gateway!');
    console.log('   Let\'s set up your AI assistant.\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    try {
        // Load existing config or defaults
        const config = loadConfig();
        const configPath = getConfigPath();

        // Step 1: AI Provider
        console.log('━━━ Step 1: AI Provider ━━━');
        console.log('  1) Ollama (FREE, local — recommended)');
        console.log('  2) OpenAI (GPT-4o, requires API key)');
        console.log('  3) Anthropic (Claude, requires API key)');
        console.log('  4) OpenRouter (100+ models, requires API key)');
        const providerChoice = await ask('  Choose provider [1]: ');

        switch (providerChoice.trim()) {
            case '2': {
                config.agent.provider = 'openai';
                config.agent.model = 'gpt-4o';
                const key = await ask('  OpenAI API Key: ');
                if (key.trim()) {
                    config.providers.openai = { apiKey: key.trim() };
                }
                break;
            }
            case '3': {
                config.agent.provider = 'anthropic';
                config.agent.model = 'claude-sonnet-4-20250514';
                const key = await ask('  Anthropic API Key: ');
                if (key.trim()) {
                    config.providers.anthropic = { apiKey: key.trim() };
                }
                break;
            }
            case '4': {
                config.agent.provider = 'openrouter';
                config.agent.model = 'anthropic/claude-sonnet-4-20250514';
                const key = await ask('  OpenRouter API Key: ');
                if (key.trim()) {
                    config.providers.openrouter = { apiKey: key.trim() };
                }
                break;
            }
            default: {
                config.agent.provider = 'ollama';
                config.agent.model = 'llama3.2';
                const url = await ask('  Ollama URL [http://127.0.0.1:11434]: ');
                if (url.trim()) {
                    config.providers.ollama = { baseUrl: url.trim() };
                }
                break;
            }
        }

        // Step 2: Channels
        console.log('\n━━━ Step 2: Chat Channels ━━━');
        const enableTelegram = await ask('  Enable Telegram? (y/N): ');
        if (enableTelegram.toLowerCase() === 'y') {
            const token = await ask('  Telegram Bot Token: ');
            if (token.trim()) {
                config.channels.telegram = { token: token.trim() };
            }
        }

        const enableDiscord = await ask('  Enable Discord? (y/N): ');
        if (enableDiscord.toLowerCase() === 'y') {
            const token = await ask('  Discord Bot Token: ');
            if (token.trim()) {
                config.channels.discord = { token: token.trim() };
            }
        }

        const enableWhatsApp = await ask('  Enable WhatsApp? (y/N): ');
        if (enableWhatsApp.toLowerCase() === 'y') {
            (config.channels as any).whatsapp = { enabled: true };
            console.log('  → QR code will appear when you start the gateway');
        }

        // Step 3: Security
        console.log('\n━━━ Step 3: Security ━━━');
        const setToken = await ask('  Set gateway auth token? (y/N): ');
        if (setToken.toLowerCase() === 'y') {
            const { randomBytes } = await import('node:crypto');
            const token = `cb_${randomBytes(24).toString('hex')}`;
            config.token = token;
            console.log(`  → Token: ${token}`);
            console.log('  → Save this token! You\'ll need it for API access.');
        }

        // Save config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`\n✅ Config saved to: ${configPath}`);

        // Summary
        console.log('\n━━━ Summary ━━━');
        console.log(`  Provider: ${config.agent.provider}`);
        console.log(`  Model:    ${config.agent.model}`);
        console.log(`  Channels: ${getEnabledChannels(config).join(', ') || 'WebChat only'}`);
        console.log(`  Auth:     ${config.token ? 'Token set' : 'Open (no token)'}`);

        console.log('\n🚀 Start gateway with:');
        console.log('   coreblow gateway start\n');

    } finally {
        rl.close();
    }
}

function getEnabledChannels(config: GatewayConfig): string[] {
    const channels: string[] = [];
    if (config.channels.telegram?.token) channels.push('Telegram');
    if (config.channels.discord?.token) channels.push('Discord');
    if ((config.channels as any).whatsapp?.enabled) channels.push('WhatsApp');
    if (config.channels.webchat?.enabled) channels.push('WebChat');
    return channels;
}
