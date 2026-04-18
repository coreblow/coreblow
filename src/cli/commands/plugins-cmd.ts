/**
 * CoreBlow CLI — `coreblow plugins`
 *
 * Manage CoreBlow plugins and extensions.
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
const reset = '\x1b[0m';

const PLUGINS_DIR = path.join(os.homedir(), '.coreblow', 'plugins');
const PLUGINS_FILE = path.join(PLUGINS_DIR, 'installed.json');

interface PluginEntry { name: string; version: string; enabled: boolean; installedAt: string; description?: string; }

function loadPlugins(): PluginEntry[] {
    try { return JSON.parse(fs.readFileSync(PLUGINS_FILE, 'utf8')); } catch { return []; }
}
function savePlugins(plugins: PluginEntry[]): void {
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    fs.writeFileSync(PLUGINS_FILE, JSON.stringify(plugins, null, 2) + '\n', 'utf8');
}

export function registerPluginsCommand(parent: Command): void {
    const cmd = parent.command('plugins').description('Manage CoreBlow plugins and extensions');

    cmd.command('list').alias('ls').description('List installed plugins')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const plugins = loadPlugins();
            if (opts.json) { console.log(JSON.stringify(plugins, null, 2)); return; }
            console.log(`\n  ${bold}Installed Plugins${reset} (${plugins.length})\n`);
            if (plugins.length === 0) { console.log(`  ${dim}No plugins installed.${reset}\n`); return; }
            for (const p of plugins) {
                const status = p.enabled ? `${green}●${reset}` : `${dim}○${reset}`;
                console.log(`  ${status} ${cyan}${p.name}${reset}@${p.version}${p.description ? ` — ${dim}${p.description}${reset}` : ''}`);
            }
            console.log();
        });

    cmd.command('install <name>').description('Install a plugin')
        .option('--version <ver>', 'Specific version', 'latest')
        .action((name: string, opts: { version: string }) => {
            const plugins = loadPlugins();
            if (plugins.find(p => p.name === name)) {
                console.log(`${yellow}⚠${reset} Plugin "${name}" already installed. Use ${cyan}coreblow plugins update${reset}.`);
                return;
            }
            plugins.push({ name, version: opts.version, enabled: true, installedAt: new Date().toISOString() });
            savePlugins(plugins);
            console.log(`${green}✓${reset} Installed ${cyan}${name}${reset}@${opts.version}`);
        });

    cmd.command('remove <name>').alias('rm').description('Remove a plugin')
        .action((name: string) => {
            const plugins = loadPlugins();
            const idx = plugins.findIndex(p => p.name === name);
            if (idx === -1) { console.error(`${red}✗${reset} Plugin "${name}" not found.`); process.exitCode = 1; return; }
            plugins.splice(idx, 1);
            savePlugins(plugins);
            console.log(`${green}✓${reset} Removed ${cyan}${name}${reset}`);
        });

    cmd.command('enable <name>').description('Enable a plugin')
        .action((name: string) => {
            const plugins = loadPlugins();
            const p = plugins.find(p => p.name === name);
            if (!p) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            p.enabled = true; savePlugins(plugins);
            console.log(`${green}✓${reset} Enabled ${cyan}${name}${reset}`);
        });

    cmd.command('disable <name>').description('Disable a plugin')
        .action((name: string) => {
            const plugins = loadPlugins();
            const p = plugins.find(p => p.name === name);
            if (!p) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            p.enabled = false; savePlugins(plugins);
            console.log(`${green}✓${reset} Disabled ${cyan}${name}${reset}`);
        });

    cmd.command('update').description('Update all plugins')
        .action(() => { console.log(`${dim}Plugin updates are not yet available.${reset}`); });
}
