/**
 * CoreBlow CLI — `coreblow skills`
 *
 * List and inspect available agent skills.
 * Skills are modular capabilities that agents can use.
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

const SKILLS_DIR = path.join(os.homedir(), '.coreblow', 'skills');
const SKILLS_FILE = path.join(os.homedir(), '.coreblow', 'skills.json');

interface SkillEntry {
    name: string;
    description: string;
    version: string;
    enabled: boolean;
    builtIn: boolean;
    triggers?: string[];
}

const BUILTIN_SKILLS: SkillEntry[] = [
    { name: 'web-search', description: 'Search the web using configured search provider', version: '1.0.0', enabled: true, builtIn: true, triggers: ['search', 'google', 'find'] },
    { name: 'code-exec', description: 'Execute code snippets in a sandboxed environment', version: '1.0.0', enabled: true, builtIn: true, triggers: ['run', 'execute', 'eval'] },
    { name: 'file-read', description: 'Read and analyze local files', version: '1.0.0', enabled: true, builtIn: true, triggers: ['read', 'open', 'cat'] },
    { name: 'file-write', description: 'Write content to local files', version: '1.0.0', enabled: false, builtIn: true, triggers: ['write', 'save'] },
    { name: 'image-gen', description: 'Generate images using AI models', version: '1.0.0', enabled: false, builtIn: true, triggers: ['draw', 'generate image'] },
    { name: 'memory', description: 'Persistent memory across sessions', version: '1.0.0', enabled: true, builtIn: true, triggers: ['remember', 'recall'] },
    { name: 'calendar', description: 'Manage calendar events and reminders', version: '1.0.0', enabled: false, builtIn: true, triggers: ['schedule', 'remind'] },
    { name: 'shell', description: 'Execute shell commands (with approval)', version: '1.0.0', enabled: false, builtIn: true, triggers: ['bash', 'terminal'] },
];

function loadSkills(): SkillEntry[] {
    try {
        const custom = JSON.parse(fs.readFileSync(SKILLS_FILE, 'utf8')) as SkillEntry[];
        return [...BUILTIN_SKILLS, ...custom.filter(s => !s.builtIn)];
    } catch { return [...BUILTIN_SKILLS]; }
}

function saveSkills(skills: SkillEntry[]): void {
    fs.mkdirSync(path.dirname(SKILLS_FILE), { recursive: true });
    fs.writeFileSync(SKILLS_FILE, JSON.stringify(skills.filter(s => !s.builtIn), null, 2) + '\n', 'utf8');
}

export function registerSkillsCommand(parent: Command): void {
    const cmd = parent.command('skills').description('List and inspect available skills');

    cmd.command('list').alias('ls').description('List all skills')
        .option('--json', 'Output as JSON')
        .option('--enabled', 'Show only enabled skills')
        .action((opts: { json?: boolean; enabled?: boolean }) => {
            let skills = loadSkills();
            if (opts.enabled) skills = skills.filter(s => s.enabled);
            if (opts.json) { console.log(JSON.stringify(skills, null, 2)); return; }

            console.log(`\n  ${bold}Skills${reset} (${skills.length})\n`);
            const nameWidth = Math.max(...skills.map(s => s.name.length), 10);
            for (const s of skills) {
                const icon = s.enabled ? `${green}●${reset}` : `${dim}○${reset}`;
                const badge = s.builtIn ? `${dim}[builtin]${reset}` : `${cyan}[custom]${reset}`;
                console.log(`  ${icon} ${cyan}${s.name.padEnd(nameWidth)}${reset}  ${s.description}  ${badge}`);
            }
            console.log();
        });

    cmd.command('inspect <name>').description('Show details for a skill')
        .action((name: string) => {
            const skills = loadSkills();
            const skill = skills.find(s => s.name === name);
            if (!skill) { console.error(`${red}✗${reset} Skill "${name}" not found.`); process.exitCode = 1; return; }
            console.log(`\n  ${bold}Skill: ${cyan}${skill.name}${reset}\n`);
            console.log(`  ${dim}Description:${reset}  ${skill.description}`);
            console.log(`  ${dim}Version:${reset}      ${skill.version}`);
            console.log(`  ${dim}Enabled:${reset}      ${skill.enabled ? 'yes' : 'no'}`);
            console.log(`  ${dim}Built-in:${reset}     ${skill.builtIn ? 'yes' : 'no'}`);
            if (skill.triggers?.length) console.log(`  ${dim}Triggers:${reset}     ${skill.triggers.join(', ')}`);
            console.log();
        });

    cmd.command('enable <name>').description('Enable a skill')
        .action((name: string) => {
            const skills = loadSkills();
            const s = skills.find(s => s.name === name);
            if (!s) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            s.enabled = true; saveSkills(skills);
            console.log(`${green}✓${reset} Enabled skill ${cyan}${name}${reset}`);
        });

    cmd.command('disable <name>').description('Disable a skill')
        .action((name: string) => {
            const skills = loadSkills();
            const s = skills.find(s => s.name === name);
            if (!s) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            s.enabled = false; saveSkills(skills);
            console.log(`${green}✓${reset} Disabled skill ${cyan}${name}${reset}`);
        });
}
