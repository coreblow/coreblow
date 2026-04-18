/**
 * CoreBlow CLI — `coreblow mcp`
 *
 * Manage Model Context Protocol (MCP) configuration and servers.
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

const MCP_FILE = path.join(os.homedir(), '.coreblow', 'mcp.json');

interface McpServer {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled: boolean;
}

interface McpConfig { servers: McpServer[] }

function loadMcp(): McpConfig {
    try { return JSON.parse(fs.readFileSync(MCP_FILE, 'utf8')); } catch { return { servers: [] }; }
}
function saveMcp(config: McpConfig): void {
    fs.mkdirSync(path.dirname(MCP_FILE), { recursive: true });
    fs.writeFileSync(MCP_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function registerMcpCommand(parent: Command): void {
    const cmd = parent.command('mcp').description('Manage MCP config and servers');

    cmd.command('status').description('Show MCP configuration status')
        .action(() => {
            const config = loadMcp();
            console.log(`\n  ${bold}MCP Configuration${reset}\n`);
            console.log(`  ${dim}Config:${reset}  ${MCP_FILE}`);
            console.log(`  ${dim}Servers:${reset} ${config.servers.length}\n`);
            for (const s of config.servers) {
                const icon = s.enabled ? `${green}●${reset}` : `${dim}○${reset}`;
                console.log(`  ${icon} ${cyan}${s.name}${reset}  ${dim}${s.command} ${(s.args ?? []).join(' ')}${reset}`);
            }
            if (config.servers.length === 0) console.log(`  ${dim}No MCP servers configured.${reset}`);
            console.log();
        });

    cmd.command('add <name> <command> [args...]').description('Add an MCP server')
        .action((name: string, command: string, args: string[]) => {
            const config = loadMcp();
            if (config.servers.find(s => s.name === name)) {
                console.error(`${red}✗${reset} Server "${name}" already exists.`);
                process.exitCode = 1;
                return;
            }
            config.servers.push({ name, command, args, enabled: true });
            saveMcp(config);
            console.log(`${green}✓${reset} Added MCP server ${cyan}${name}${reset}: ${command} ${args.join(' ')}`);
        });

    cmd.command('remove <name>').alias('rm').description('Remove an MCP server')
        .action((name: string) => {
            const config = loadMcp();
            const idx = config.servers.findIndex(s => s.name === name);
            if (idx === -1) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            config.servers.splice(idx, 1);
            saveMcp(config);
            console.log(`${green}✓${reset} Removed ${cyan}${name}${reset}`);
        });

    cmd.command('enable <name>').description('Enable an MCP server')
        .action((name: string) => {
            const config = loadMcp();
            const s = config.servers.find(s => s.name === name);
            if (!s) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            s.enabled = true; saveMcp(config);
            console.log(`${green}✓${reset} Enabled ${cyan}${name}${reset}`);
        });

    cmd.command('disable <name>').description('Disable an MCP server')
        .action((name: string) => {
            const config = loadMcp();
            const s = config.servers.find(s => s.name === name);
            if (!s) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            s.enabled = false; saveMcp(config);
            console.log(`${green}✓${reset} Disabled ${cyan}${name}${reset}`);
        });

    cmd.command('config').description('Show full MCP config')
        .action(() => { console.log(JSON.stringify(loadMcp(), null, 2)); });
}
