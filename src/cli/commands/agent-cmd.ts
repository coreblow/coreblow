/**
 * CoreBlow — Agent Command (One-shot)
 *
 * CLI command: `coreblow agent --message "Hello"`
 * Non-interactive one-shot message to AI via gateway.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m',
    orange: '\x1b[38;5;173m',
};

export function registerAgentCommand(program: Command): void {
    program
        .command('agent')
        .description('Send a one-shot message to the AI agent')
        .option('-m, --message <message>', 'Message to send')
        .option('-p, --port <port>', 'Gateway port', '3000')
        .option('--model <model>', 'Model to use')
        .option('--json', 'Output raw JSON response')
        .action(async (opts) => {
            if (!opts.message) {
                console.log(`  ${c.red}✗ --message is required${c.reset}`);
                console.log(`  ${c.dim}Usage: coreblow agent --message "Hello"${c.reset}`);
                process.exit(1);
            }

            const port = opts.port;
            const baseUrl = `http://127.0.0.1:${port}`;

            // Check gateway
            try {
                await fetch(`${baseUrl}/healthz`);
            } catch {
                console.log(`  ${c.red}✗ Gateway not running on port ${port}${c.reset}`);
                console.log(`  ${c.dim}Start with: coreblow gateway${c.reset}`);
                process.exit(1);
            }

            // Send message
            try {
                const res = await fetch(`${baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: opts.message,
                        model: opts.model,
                    }),
                });

                const data = await res.json() as {
                    text?: string; error?: string; message?: string;
                    usage?: { input: number; output: number; total: number };
                    durationMs?: number;
                };

                if (opts.json) {
                    console.log(JSON.stringify(data, null, 2));
                } else if (data.error) {
                    console.log(`\n  ${c.red}✗ ${data.error}${c.reset}`);
                    if (data.message) console.log(`  ${c.dim}${data.message}${c.reset}`);
                } else {
                    console.log(`\n${data.text ?? ''}`);
                    if (data.usage) {
                        console.log(`\n${c.dim}[${data.usage.total} tokens, ${data.durationMs}ms]${c.reset}`);
                    }
                }
            } catch (err) {
                console.log(`  ${c.red}✗ ${err instanceof Error ? err.message : String(err)}${c.reset}`);
                process.exit(1);
            }
        });
}
