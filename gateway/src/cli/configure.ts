/**
 * src/cli/configure.ts
 * CLI: coreblow configure — edit config interactively
 */

import fs from 'node:fs';
import readline from 'node:readline';
import { getConfigPath, loadConfig } from '../gateway/config.js';

export async function configureCommand(section?: string) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

    try {
        const config = loadConfig();
        const configPath = getConfigPath();

        if (!section || section === 'provider') {
            console.log('\n━━━ AI Provider ━━━');
            console.log(`  Current: ${config.agent.provider}/${config.agent.model}`);
            const provider = await ask('  Provider (ollama/openai/anthropic/openrouter) [keep]: ');
            if (provider.trim()) {
                config.agent.provider = provider.trim();
                const model = await ask('  Model name: ');
                if (model.trim()) config.agent.model = model.trim();

                if (provider.trim() === 'openai') {
                    const key = await ask('  API Key: ');
                    if (key.trim()) config.providers.openai = { apiKey: key.trim(), ...config.providers.openai };
                } else if (provider.trim() === 'anthropic') {
                    const key = await ask('  API Key: ');
                    if (key.trim()) config.providers.anthropic = { apiKey: key.trim() };
                } else if (provider.trim() === 'openrouter') {
                    const key = await ask('  API Key: ');
                    if (key.trim()) config.providers.openrouter = { apiKey: key.trim() };
                }
            }
        }

        if (!section || section === 'channels') {
            console.log('\n━━━ Channels ━━━');
            const telegram = await ask(`  Telegram token [${config.channels.telegram?.token ? '***set***' : 'not set'}]: `);
            if (telegram.trim()) config.channels.telegram = { token: telegram.trim() };

            const discord = await ask(`  Discord token [${config.channels.discord?.token ? '***set***' : 'not set'}]: `);
            if (discord.trim()) config.channels.discord = { token: discord.trim() };
        }

        if (!section || section === 'port') {
            const port = await ask(`  Gateway port [${config.port}]: `);
            if (port.trim()) config.port = parseInt(port.trim(), 10);
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`\n✅ Config updated: ${configPath}`);

    } finally {
        rl.close();
    }
}
