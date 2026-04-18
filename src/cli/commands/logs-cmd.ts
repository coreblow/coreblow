/**
 * CoreBlow CLI — `coreblow logs` command
 *
 * Stream or view gateway logs. In development mode, tails the log
 * output from the running gateway. Can also filter by subsystem.
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
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

// ─── Log File Discovery ─────────────────────────────────────────

function resolveLogDir(): string {
    return process.env.COREBLOW_LOG_DIR
        ?? path.join(os.homedir(), '.coreblow', 'logs');
}

function resolveLogFile(): string {
    return path.join(resolveLogDir(), 'gateway.log');
}

// ─── ANSI log level coloring ─────────────────────────────────────

function colorLevel(level: string): string {
    switch (level.toLowerCase()) {
        case 'error': return `${red}${bold}ERR${reset}`;
        case 'warn':  return `${yellow}WRN${reset}`;
        case 'info':  return `${green}INF${reset}`;
        case 'debug': return `${dim}DBG${reset}`;
        default:      return `${dim}${level}${reset}`;
    }
}

// ─── Command Registration ───────────────────────────────────────

export function registerLogsCommand(parent: Command): void {
    const cmd = parent
        .command('logs')
        .description('View or stream gateway logs');

    // coreblow logs tail
    cmd.command('tail')
        .description('Tail the gateway log file')
        .option('-n, --lines <count>', 'Number of lines to show', '50')
        .option('-f, --follow', 'Follow log output (like tail -f)')
        .option('--level <level>', 'Filter by log level (error, warn, info, debug)')
        .action((opts: { lines: string; follow?: boolean; level?: string }) => {
            const logFile = resolveLogFile();

            if (!fs.existsSync(logFile)) {
                console.log(`${yellow}⚠${reset} Log file not found: ${logFile}`);
                console.log(`${dim}The gateway may not have written logs yet, or logging file output is disabled.${reset}`);
                console.log(`${dim}Tip: Gateway console output is always visible when running ${cyan}coreblow gateway${reset}${dim}.${reset}`);
                return;
            }

            const lineCount = parseInt(opts.lines, 10) || 50;

            // Read last N lines
            const content = fs.readFileSync(logFile, 'utf8');
            let lines = content.split('\n').filter(l => l.trim().length > 0);

            // Level filter
            if (opts.level) {
                const filterLevel = opts.level.toLowerCase();
                lines = lines.filter(line => {
                    const lower = line.toLowerCase();
                    return lower.includes(`"level":"${filterLevel}"`) || lower.includes(`[${filterLevel}]`);
                });
            }

            // Show last N
            const tail = lines.slice(-lineCount);
            for (const line of tail) {
                console.log(formatLogLine(line));
            }

            // Follow mode
            if (opts.follow) {
                console.log(`\n${dim}--- following ${logFile} (Ctrl+C to stop) ---${reset}\n`);
                let lastSize = fs.statSync(logFile).size;

                const interval = setInterval(() => {
                    try {
                        const stat = fs.statSync(logFile);
                        if (stat.size > lastSize) {
                            const fd = fs.openSync(logFile, 'r');
                            const buffer = Buffer.alloc(stat.size - lastSize);
                            fs.readSync(fd, buffer, 0, buffer.length, lastSize);
                            fs.closeSync(fd);
                            lastSize = stat.size;

                            const newLines = buffer.toString('utf8').split('\n').filter(l => l.trim());
                            for (const line of newLines) {
                                if (opts.level) {
                                    const lower = line.toLowerCase();
                                    if (!lower.includes(`"level":"${opts.level}"`) && !lower.includes(`[${opts.level}]`)) {
                                        continue;
                                    }
                                }
                                console.log(formatLogLine(line));
                            }
                        }
                    } catch {
                        // file might be rotated
                    }
                }, 500);

                process.on('SIGINT', () => {
                    clearInterval(interval);
                    process.exit(0);
                });
            }
        });

    // coreblow logs path
    cmd.command('path')
        .description('Show the log file path')
        .action(() => {
            const logFile = resolveLogFile();
            const exists = fs.existsSync(logFile);
            console.log(`${bold}Log file:${reset} ${logFile}`);
            console.log(`${dim}Status:${reset} ${exists ? `${green}exists${reset}` : `${yellow}not found${reset}`}`);
            if (exists) {
                const stat = fs.statSync(logFile);
                console.log(`${dim}Size:${reset} ${(stat.size / 1024).toFixed(1)} KB`);
            }
        });

    // coreblow logs clear
    cmd.command('clear')
        .description('Clear the gateway log file')
        .action(() => {
            const logFile = resolveLogFile();
            if (fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, '', 'utf8');
                console.log(`${green}✓${reset} Log file cleared.`);
            } else {
                console.log(`${dim}No log file to clear.${reset}`);
            }
        });

    // Default: show tail
    cmd.action(() => {
        cmd.commands.find(c => c.name() === 'tail')?.parse(process.argv);
    });
}

// ─── Log Line Formatting ────────────────────────────────────────

function formatLogLine(line: string): string {
    // Try to parse JSON log lines (pino format)
    try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        const ts = parsed.time ? new Date(parsed.time as number).toISOString().slice(11, 23) : '';
        const level = colorLevel(String(parsed.level ?? parsed.lvl ?? '?'));
        const msg = parsed.msg ?? parsed.message ?? '';
        const subsystem = parsed.subsystem ? `${cyan}[${parsed.subsystem}]${reset} ` : '';
        return `${dim}${ts}${reset} ${level} ${subsystem}${msg}`;
    } catch {
        // Plain text log line
        return line;
    }
}
