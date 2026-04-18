/**
 * CoreBlow CLI — `coreblow health`
 *
 * Fetch health status from the running gateway.
 * Queries /healthz and /readyz endpoints.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const bold = '\x1b[1m';
const dim = '\x1b[2m';
const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

async function fetchHealth(endpoint: string, port: string, host: string): Promise<{ ok: boolean; data: unknown }> {
    try {
        const res = await fetch(`http://${host}:${port}${endpoint}`);
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (err) {
        return { ok: false, data: { error: (err as Error).message } };
    }
}

export function registerHealthCommand(parent: Command): void {
    parent
        .command('health')
        .description('Fetch health from the running gateway')
        .option('--port <port>', 'Gateway port', '3000')
        .option('--host <host>', 'Gateway host', '127.0.0.1')
        .option('--json', 'Output as JSON')
        .action(async (opts: { port: string; host: string; json?: boolean }) => {
            const liveness = await fetchHealth('/healthz', opts.port, opts.host);
            const readiness = await fetchHealth('/readyz', opts.port, opts.host);

            if (opts.json) {
                console.log(JSON.stringify({ liveness: liveness.data, readiness: readiness.data }, null, 2));
                if (!liveness.ok || !readiness.ok) process.exitCode = 1;
                return;
            }

            console.log(`\n  ${bold}CoreBlow Gateway Health${reset}\n`);
            console.log(`  ${dim}Endpoint:${reset}  http://${opts.host}:${opts.port}\n`);

            // Liveness
            const liveIcon = liveness.ok ? `${green}●${reset}` : `${red}✗${reset}`;
            const liveStatus = liveness.ok ? `${green}alive${reset}` : `${red}unreachable${reset}`;
            console.log(`  ${liveIcon} Liveness   ${liveStatus}`);

            // Readiness
            const readyData = readiness.data as { ready?: boolean; checks?: Record<string, unknown> } | null;
            const readyIcon = readiness.ok && readyData?.ready ? `${green}●${reset}` : `${yellow}◐${reset}`;
            const readyStatus = readiness.ok && readyData?.ready ? `${green}ready${reset}` : readiness.ok ? `${yellow}not ready${reset}` : `${red}unreachable${reset}`;
            console.log(`  ${readyIcon} Readiness  ${readyStatus}`);

            // Additional checks
            if (readyData?.checks && typeof readyData.checks === 'object') {
                for (const [name, result] of Object.entries(readyData.checks)) {
                    const checkOk = (result as { ok?: boolean })?.ok !== false;
                    const icon = checkOk ? `${green}✓${reset}` : `${red}✗${reset}`;
                    console.log(`    ${icon} ${name}`);
                }
            }

            console.log();

            if (!liveness.ok) {
                console.log(`  ${red}Gateway is not running.${reset}`);
                console.log(`  ${dim}Start with: ${cyan}coreblow gateway${reset}\n`);
                process.exitCode = 1;
            }
        });
}
