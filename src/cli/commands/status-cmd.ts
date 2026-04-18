/**
 * CoreBlow — Status Command
 *
 * CLI command: `coreblow status`
 * Shows gateway status, active sessions, model info.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m',
    orange: '\x1b[38;5;173m',
};

export function registerStatusCommand(program: Command): void {
    program
        .command('status')
        .description('Show CoreBlow Gateway status')
        .option('-p, --port <port>', 'Gateway port', '3000')
        .action(async (opts) => {
            const port = opts.port;
            const baseUrl = `http://127.0.0.1:${port}`;

            console.log(`\n  ${c.orange}${c.bold}🐙 CoreBlow Status${c.reset}\n`);

            // Health check
            try {
                const healthRes = await fetch(`${baseUrl}/healthz`);
                const health = await healthRes.json() as Record<string, unknown>;

                console.log(`  ${c.green}●${c.reset} Gateway        ${c.green}Running${c.reset} on port ${port}`);
                console.log(`  ${c.dim}  Version:      ${health.version ?? 'unknown'}${c.reset}`);
                console.log(`  ${c.dim}  Status:       ${health.status ?? 'unknown'}${c.reset}`);
                console.log(`  ${c.dim}  PID:          ${process.pid}${c.reset}`);
            } catch {
                console.log(`  ${c.red}●${c.reset} Gateway        ${c.red}Not Running${c.reset}`);
                console.log(`  ${c.dim}  No gateway found on port ${port}${c.reset}`);
                console.log(`  ${c.dim}  Start with: coreblow gateway${c.reset}\n`);
                return;
            }

            // Sessions
            try {
                const sessRes = await fetch(`${baseUrl}/api/sessions`);
                const data = await sessRes.json() as { sessions: Array<{ id: string; state: string; messageCount: number }> };
                console.log(`  ${c.cyan}◆${c.reset} Sessions       ${data.sessions.length} active`);
                for (const s of data.sessions.slice(0, 5)) {
                    console.log(`  ${c.dim}  └ ${s.id} [${s.state}] ${s.messageCount} msgs${c.reset}`);
                }
            } catch {
                console.log(`  ${c.yellow}◆${c.reset} Sessions       ${c.dim}unavailable${c.reset}`);
            }

            console.log();
        });
}
