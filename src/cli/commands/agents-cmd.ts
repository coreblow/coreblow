/**
 * CoreBlow CLI — `coreblow agents`
 *
 * Manage isolated agent workspaces: list, create, delete, inspect.
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

const AGENTS_DIR = path.join(os.homedir(), '.coreblow', 'agents');

function ensureAgentsDir(): void {
    fs.mkdirSync(AGENTS_DIR, { recursive: true });
}

interface AgentManifest {
    name: string;
    description?: string;
    model?: string;
    provider?: string;
    systemPrompt?: string;
    tools?: string[];
    createdAt: string;
}

export function registerAgentsCommand(parent: Command): void {
    const cmd = parent
        .command('agents')
        .description('Manage isolated agents (workspaces, auth, routing)');

    cmd.command('list')
        .alias('ls')
        .description('List configured agents')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            ensureAgentsDir();
            const entries = fs.readdirSync(AGENTS_DIR, { withFileTypes: true })
                .filter(e => e.isDirectory());

            const agents: AgentManifest[] = [];
            for (const entry of entries) {
                const manifestPath = path.join(AGENTS_DIR, entry.name, 'agent.json');
                try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AgentManifest;
                    agents.push(manifest);
                } catch {
                    agents.push({ name: entry.name, createdAt: 'unknown' });
                }
            }

            if (opts.json) {
                console.log(JSON.stringify(agents, null, 2));
                return;
            }

            console.log(`\n  ${bold}Agents${reset} (${agents.length})\n`);
            if (agents.length === 0) {
                console.log(`  ${dim}No agents configured.${reset}`);
                console.log(`  ${dim}Run ${cyan}coreblow agents create <name>${reset}${dim} to create one.${reset}\n`);
                return;
            }
            for (const a of agents) {
                const model = a.model ? `${dim}[${a.provider ?? '?'}/${a.model}]${reset}` : '';
                const desc = a.description ? ` — ${dim}${a.description}${reset}` : '';
                console.log(`  ${cyan}${a.name}${reset} ${model}${desc}`);
            }
            console.log();
        });

    cmd.command('create <name>')
        .description('Create a new agent workspace')
        .option('--model <model>', 'Default model')
        .option('--provider <provider>', 'Default provider')
        .option('--description <desc>', 'Agent description')
        .action((name: string, opts: { model?: string; provider?: string; description?: string }) => {
            ensureAgentsDir();
            const agentDir = path.join(AGENTS_DIR, name);

            if (fs.existsSync(agentDir)) {
                console.error(`${red}✗${reset} Agent "${name}" already exists.`);
                process.exitCode = 1;
                return;
            }

            fs.mkdirSync(agentDir, { recursive: true });
            const manifest: AgentManifest = {
                name,
                description: opts.description,
                model: opts.model,
                provider: opts.provider,
                systemPrompt: `You are ${name}, a specialized CoreBlow agent.`,
                tools: [],
                createdAt: new Date().toISOString(),
            };
            fs.writeFileSync(path.join(agentDir, 'agent.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
            console.log(`${green}✓${reset} Agent ${cyan}${name}${reset} created at ${dim}${agentDir}${reset}`);
        });

    cmd.command('delete <name>')
        .alias('rm')
        .description('Delete an agent workspace')
        .option('--confirm', 'Skip confirmation')
        .action((name: string, opts: { confirm?: boolean }) => {
            const agentDir = path.join(AGENTS_DIR, name);
            if (!fs.existsSync(agentDir)) {
                console.error(`${red}✗${reset} Agent "${name}" not found.`);
                process.exitCode = 1;
                return;
            }
            if (!opts.confirm) {
                console.log(`${yellow}⚠${reset} Add --confirm to delete agent "${name}".`);
                return;
            }
            fs.rmSync(agentDir, { recursive: true, force: true });
            console.log(`${green}✓${reset} Agent ${cyan}${name}${reset} deleted.`);
        });

    cmd.command('inspect <name>')
        .description('Show agent configuration')
        .action((name: string) => {
            const manifestPath = path.join(AGENTS_DIR, name, 'agent.json');
            if (!fs.existsSync(manifestPath)) {
                console.error(`${red}✗${reset} Agent "${name}" not found.`);
                process.exitCode = 1;
                return;
            }
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            console.log(`\n  ${bold}Agent: ${cyan}${name}${reset}\n`);
            console.log(JSON.stringify(manifest, null, 2));
            console.log();
        });
}
