/**
 * CoreBlow CLI — `coreblow setup`
 *
 * Initialize local config directory and agent workspace.
 * Creates ~/.coreblow/ with a default coreblow.json template,
 * validates Node.js version, and optionally runs onboarding.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const orange = '\x1b[38;5;173m';
const reset = '\x1b[0m';

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const CONFIG_FILE = path.join(CONFIG_DIR, 'coreblow.json');
const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
const AGENTS_DIR = path.join(CONFIG_DIR, 'agents');
const PLUGINS_DIR = path.join(CONFIG_DIR, 'plugins');
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');

const DEFAULT_CONFIG = {
    $schema: 'https://coreblow.com/schema/config.json',
    version: 1,
    provider: '',
    model: '',
    gateway: {
        port: 3000,
        host: '0.0.0.0',
    },
    providers: {},
    channels: {},
    agent: {
        systemPrompt: 'You are CoreBlow, a helpful AI assistant.',
        maxContextTokens: 128_000,
        maxOutputTokens: 4_096,
        temperature: 0.7,
    },
};

export function registerSetupCommand(parent: Command): void {
    parent
        .command('setup')
        .description('Initialize local config and agent workspace')
        .option('--force', 'Overwrite existing config')
        .option('--skip-onboard', 'Skip interactive onboarding after setup')
        .action(async (opts: { force?: boolean; skipOnboard?: boolean }) => {
            console.log(`\n  ${orange}${bold}🐙 CoreBlow Setup${reset}\n`);

            // 1. Check Node.js version
            const [major, minor] = process.versions.node.split('.').map(Number);
            if (major < 22 || (major === 22 && minor < 12)) {
                console.error(`  ${red}✗${reset} Node.js v22.12+ required (current: v${process.versions.node})`);
                process.exitCode = 1;
                return;
            }
            console.log(`  ${green}✓${reset} Node.js v${process.versions.node}`);

            // 2. Create directory structure
            const dirs = [CONFIG_DIR, LOGS_DIR, AGENTS_DIR, PLUGINS_DIR, BACKUPS_DIR];
            for (const dir of dirs) {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`  ${green}✓${reset} Created ${dim}${dir}${reset}`);
                } else {
                    console.log(`  ${dim}∙${reset} Exists  ${dim}${dir}${reset}`);
                }
            }

            // 3. Create config file
            if (fs.existsSync(CONFIG_FILE) && !opts.force) {
                console.log(`  ${dim}∙${reset} Config  ${dim}${CONFIG_FILE}${reset} ${yellow}(exists, use --force to overwrite)${reset}`);
            } else {
                fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n', 'utf8');
                console.log(`  ${green}✓${reset} Config  ${dim}${CONFIG_FILE}${reset}`);
            }

            // 4. Create .gitignore in config dir
            const gitignore = path.join(CONFIG_DIR, '.gitignore');
            if (!fs.existsSync(gitignore)) {
                fs.writeFileSync(gitignore, '# CoreBlow local state\nlogs/\n*.log\n', 'utf8');
            }

            console.log(`\n  ${green}${bold}✓ Setup complete!${reset}\n`);
            console.log(`  ${dim}Config: ${CONFIG_FILE}${reset}`);
            console.log(`  ${dim}Agents: ${AGENTS_DIR}${reset}`);
            console.log(`  ${dim}Logs:   ${LOGS_DIR}${reset}\n`);

            if (!opts.skipOnboard) {
                console.log(`  ${cyan}Next step:${reset} Run ${bold}coreblow onboard${reset} to configure your first provider.\n`);
            }
        });
}
