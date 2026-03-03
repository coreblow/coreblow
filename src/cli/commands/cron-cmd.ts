/**
 * CoreBlow CLI — `coreblow cron`
 *
 * Manage scheduled tasks via the gateway cron scheduler.
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

const CRON_FILE = path.join(os.homedir(), '.coreblow', 'cron.json');

interface CronJob {
    id: string;
    schedule: string;
    command: string;
    description?: string;
    enabled: boolean;
    lastRun?: string;
    createdAt: string;
}

function loadJobs(): CronJob[] {
    try { return JSON.parse(fs.readFileSync(CRON_FILE, 'utf8')); } catch { return []; }
}
function saveJobs(jobs: CronJob[]): void {
    fs.mkdirSync(path.dirname(CRON_FILE), { recursive: true });
    fs.writeFileSync(CRON_FILE, JSON.stringify(jobs, null, 2) + '\n', 'utf8');
}

let idSeq = 0;
function nextId(): string { return `cron-${Date.now()}-${++idSeq}`; }

export function registerCronCommand(parent: Command): void {
    const cmd = parent.command('cron').description('Manage cron jobs via the gateway scheduler');

    cmd.command('list').alias('ls').description('List scheduled jobs')
        .option('--json', 'Output as JSON')
        .action((opts: { json?: boolean }) => {
            const jobs = loadJobs();
            if (opts.json) { console.log(JSON.stringify(jobs, null, 2)); return; }
            console.log(`\n  ${bold}Cron Jobs${reset} (${jobs.length})\n`);
            if (jobs.length === 0) { console.log(`  ${dim}No jobs scheduled.${reset}\n`); return; }
            for (const j of jobs) {
                const status = j.enabled ? `${green}●${reset}` : `${dim}○${reset}`;
                const last = j.lastRun ? `${dim}last: ${j.lastRun}${reset}` : '';
                console.log(`  ${status} ${cyan}${j.id}${reset}  ${dim}${j.schedule}${reset}  ${j.command}  ${last}`);
            }
            console.log();
        });

    cmd.command('add <schedule> <command...>').description('Add a cron job (e.g. "*/5 * * * *" echo hello)')
        .option('--description <desc>', 'Job description')
        .action((schedule: string, commandParts: string[], opts: { description?: string }) => {
            const jobs = loadJobs();
            const job: CronJob = {
                id: nextId(), schedule, command: commandParts.join(' '),
                description: opts.description, enabled: true, createdAt: new Date().toISOString(),
            };
            jobs.push(job);
            saveJobs(jobs);
            console.log(`${green}✓${reset} Job ${cyan}${job.id}${reset} added: ${dim}${schedule}${reset} → ${job.command}`);
        });

    cmd.command('remove <id>').alias('rm').description('Remove a cron job')
        .action((id: string) => {
            const jobs = loadJobs();
            const idx = jobs.findIndex(j => j.id === id);
            if (idx === -1) { console.error(`${red}✗${reset} Job "${id}" not found.`); process.exitCode = 1; return; }
            jobs.splice(idx, 1);
            saveJobs(jobs);
            console.log(`${green}✓${reset} Removed job ${cyan}${id}${reset}`);
        });

    cmd.command('enable <id>').description('Enable a cron job')
        .action((id: string) => {
            const jobs = loadJobs();
            const j = jobs.find(j => j.id === id);
            if (!j) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            j.enabled = true; saveJobs(jobs);
            console.log(`${green}✓${reset} Enabled ${cyan}${id}${reset}`);
        });

    cmd.command('disable <id>').description('Disable a cron job')
        .action((id: string) => {
            const jobs = loadJobs();
            const j = jobs.find(j => j.id === id);
            if (!j) { console.error(`${red}✗${reset} Not found.`); process.exitCode = 1; return; }
            j.enabled = false; saveJobs(jobs);
            console.log(`${green}✓${reset} Disabled ${cyan}${id}${reset}`);
        });
}
