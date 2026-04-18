/**
 * CoreBlow CLI — `coreblow nodes`
 *
 * Manage gateway-owned node pairing, status, and commands.
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

const NODES_FILE = path.join(os.homedir(), '.coreblow', 'nodes.json');

interface NodeEntry {
    id: string;
    name: string;
    type: string;
    paired: boolean;
    pairingCode?: string;
    lastSeen?: string;
    createdAt: string;
}

function loadNodes(): NodeEntry[] {
    try { return JSON.parse(fs.readFileSync(NODES_FILE, 'utf8')); } catch { return []; }
}
function saveNodes(nodes: NodeEntry[]): void {
    fs.mkdirSync(path.dirname(NODES_FILE), { recursive: true });
    fs.writeFileSync(NODES_FILE, JSON.stringify(nodes, null, 2) + '\n', 'utf8');
}

export function registerNodesCommand(parent: Command): void {
    const cmd = parent.command('nodes').description('Manage gateway-owned nodes');

    cmd.command('list').alias('ls').description('List registered nodes')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const nodes = loadNodes();
            if (opts.json) { console.log(JSON.stringify(nodes, null, 2)); return; }
            console.log(`\n  ${bold}Nodes${reset} (${nodes.length})\n`);
            if (nodes.length === 0) { console.log(`  ${dim}No nodes registered.${reset}\n`); return; }
            for (const n of nodes) {
                const icon = n.paired ? `${green}●${reset}` : `${yellow}◐${reset}`;
                const seen = n.lastSeen ? `${dim}last seen: ${n.lastSeen}${reset}` : '';
                console.log(`  ${icon} ${cyan}${n.name}${reset} (${n.type})  ${dim}${n.id}${reset}  ${seen}`);
            }
            console.log();
        });

    cmd.command('add <name>').description('Register a new node')
        .option('--type <type>', 'Node type (desktop, mobile, server)', 'desktop')
        .action((name: string, opts: { type: string }) => {
            const nodes = loadNodes();
            const id = `node-${crypto.randomBytes(6).toString('hex')}`;
            const pairingCode = crypto.randomBytes(3).toString('hex').toUpperCase();
            nodes.push({ id, name, type: opts.type, paired: false, pairingCode, createdAt: new Date().toISOString() });
            saveNodes(nodes);
            console.log(`${green}✓${reset} Node ${cyan}${name}${reset} registered.`);
            console.log(`${dim}Pairing code:${reset} ${bold}${pairingCode}${reset}`);
        });

    cmd.command('remove <name>').alias('rm').description('Remove a node')
        .action((name: string) => {
            const nodes = loadNodes();
            const idx = nodes.findIndex(n => n.name === name || n.id === name);
            if (idx === -1) { console.error(`${red}✗${reset} Node not found.`); process.exitCode = 1; return; }
            nodes.splice(idx, 1); saveNodes(nodes);
            console.log(`${green}✓${reset} Removed node ${cyan}${name}${reset}`);
        });

    cmd.command('pair <name>').description('Complete pairing for a node')
        .action((name: string) => {
            const nodes = loadNodes();
            const n = nodes.find(n => n.name === name || n.id === name);
            if (!n) { console.error(`${red}✗${reset} Node not found.`); process.exitCode = 1; return; }
            n.paired = true; n.pairingCode = undefined; n.lastSeen = new Date().toISOString();
            saveNodes(nodes);
            console.log(`${green}✓${reset} Node ${cyan}${name}${reset} paired successfully.`);
        });

    cmd.command('status <name>').description('Show node details')
        .action((name: string) => {
            const nodes = loadNodes();
            const n = nodes.find(n => n.name === name || n.id === name);
            if (!n) { console.error(`${red}✗${reset} Node not found.`); process.exitCode = 1; return; }
            console.log(`\n  ${bold}Node: ${cyan}${n.name}${reset}\n`);
            console.log(`  ${dim}ID:${reset}       ${n.id}`);
            console.log(`  ${dim}Type:${reset}     ${n.type}`);
            console.log(`  ${dim}Paired:${reset}   ${n.paired ? 'yes' : 'no'}`);
            if (n.pairingCode) console.log(`  ${dim}Code:${reset}     ${n.pairingCode}`);
            if (n.lastSeen) console.log(`  ${dim}Last:${reset}     ${n.lastSeen}`);
            console.log();
        });
}
