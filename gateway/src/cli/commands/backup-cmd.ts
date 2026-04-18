/**
 * CoreBlow CLI — `coreblow backup`
 *
 * Create, restore, list, and verify backup archives of ~/.coreblow/ state.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

const CONFIG_DIR = path.join(os.homedir(), '.coreblow');
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups');

export function registerBackupCommand(parent: Command): void {
    const cmd = parent.command('backup').description('Create and verify local backup archives');

    cmd.command('create').description('Create a backup archive')
        .option('-o, --output <path>', 'Output file path')
        .action((opts: { output?: string }) => {
            fs.mkdirSync(BACKUPS_DIR, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = opts.output ?? path.join(BACKUPS_DIR, `coreblow-backup-${timestamp}.tar.gz`);

            try {
                const excludes = '--exclude=backups --exclude=logs --exclude=*.log';
                execSync(`tar czf "${filename}" ${excludes} -C "${os.homedir()}" .coreblow`, { stdio: 'pipe' });
                const stat = fs.statSync(filename);
                console.log(`${green}✓${reset} Backup created: ${cyan}${filename}${reset} (${(stat.size / 1024).toFixed(1)} KB)`);
            } catch (err) {
                console.error(`${red}✗${reset} Backup failed: ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    cmd.command('list').alias('ls').description('List available backups')
        .action(() => {
            if (!fs.existsSync(BACKUPS_DIR)) { console.log(`${dim}No backups found.${reset}`); return; }
            const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.tar.gz')).sort().reverse();
            if (files.length === 0) { console.log(`${dim}No backups found.${reset}`); return; }
            console.log(`\n  ${bold}Backups${reset} (${BACKUPS_DIR})\n`);
            for (const f of files) {
                const stat = fs.statSync(path.join(BACKUPS_DIR, f));
                const size = (stat.size / 1024).toFixed(1);
                const date = stat.mtime.toISOString().slice(0, 19).replace('T', ' ');
                console.log(`  ${cyan}${f}${reset}  ${dim}${size} KB  ${date}${reset}`);
            }
            console.log();
        });

    cmd.command('restore <file>').description('Restore from a backup archive')
        .option('--confirm', 'Required to proceed')
        .action((file: string, opts: { confirm?: boolean }) => {
            if (!opts.confirm) {
                console.log(`${yellow}⚠${reset} Restoring will overwrite current config. Add ${bold}--confirm${reset}.`);
                return;
            }
            const archivePath = fs.existsSync(file) ? file : path.join(BACKUPS_DIR, file);
            if (!fs.existsSync(archivePath)) {
                console.error(`${red}✗${reset} Backup file not found: ${file}`);
                process.exitCode = 1;
                return;
            }
            try {
                execSync(`tar xzf "${archivePath}" -C "${os.homedir()}"`, { stdio: 'pipe' });
                console.log(`${green}✓${reset} Restored from ${cyan}${archivePath}${reset}`);
            } catch (err) {
                console.error(`${red}✗${reset} Restore failed: ${(err as Error).message}`);
                process.exitCode = 1;
            }
        });

    cmd.command('verify <file>').description('Verify backup integrity')
        .action((file: string) => {
            const archivePath = fs.existsSync(file) ? file : path.join(BACKUPS_DIR, file);
            if (!fs.existsSync(archivePath)) {
                console.error(`${red}✗${reset} File not found: ${file}`);
                process.exitCode = 1;
                return;
            }
            try {
                execSync(`tar tzf "${archivePath}"`, { stdio: 'pipe' });
                const stat = fs.statSync(archivePath);
                console.log(`${green}✓${reset} Backup valid: ${cyan}${path.basename(archivePath)}${reset} (${(stat.size / 1024).toFixed(1)} KB)`);
            } catch {
                console.error(`${red}✗${reset} Backup corrupted or invalid.`);
                process.exitCode = 1;
            }
        });
}
