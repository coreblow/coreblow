/**
 * CoreBlow — Gateway Subcommand
 *
 * Commander subcommand: `coreblow gateway`
 *
 * Starts the CoreBlow Gateway server with:
 * - HTTP server bound to configurable host/port
 * - Health probe endpoints (/healthz, /api/health, /ready, /readyz)
 * - Colorful startup banner via CLIBanner
 * - Graceful shutdown on SIGINT/SIGTERM
 *
 * Follows CoreBlow's `gateway` subcommand pattern but with
 * CoreBlow's Enterprise OOP GatewayServer architecture.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { startGateway } from '../../gateway-entry.js';

/**
 * Register the `gateway` subcommand on the Commander program.
 */
export function registerGatewayCommand(program: Command): void {
    program
        .command('gateway')
        .description('Start the CoreBlow Gateway server')
        .option('-p, --port <port>', 'Port to listen on', '3000')
        .option('-b, --bind <host>', 'Host to bind to (lan = 0.0.0.0, local = 127.0.0.1)', 'lan')
        .option('--allow-unconfigured', 'Start gateway without requiring full configuration', false)
        .action(async (opts) => {
            const port = parseInt(opts.port, 10);
            const host = opts.bind === 'lan' ? '0.0.0.0' : opts.bind === 'local' ? '127.0.0.1' : opts.bind;

            await startGateway({
                port,
                host,
                allowUnconfigured: opts.allowUnconfigured,
            });
        });
}
