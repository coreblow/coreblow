/**
 * CoreBlow — Chat Command (Interactive REPL)
 *
 * CLI command: `coreblow chat`
 * Interactive chat session with AI agent via readline.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import * as readline from 'node:readline';

const c = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m',
    orange: '\x1b[38;5;173m', magenta: '\x1b[35m',
};

export function registerChatCommand(program: Command): void {
    program
        .command('chat')
        .description('Start an interactive chat session with CoreBlow')
        .option('-p, --port <port>', 'Gateway port', '3000')
        .option('-m, --model <model>', 'Model to use')
        .action(async (opts) => {
            const port = opts.port;
            const baseUrl = `http://127.0.0.1:${port}`;

            // Check gateway
            try {
                await fetch(`${baseUrl}/healthz`);
            } catch {
                console.log(`\n  ${c.red}✗ Gateway not running on port ${port}${c.reset}`);
                console.log(`  ${c.dim}Start with: coreblow gateway${c.reset}\n`);
                process.exit(1);
            }

            // Create session
            let sessionId: string;
            try {
                const res = await fetch(`${baseUrl}/api/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: opts.model }),
                });
                const data = await res.json() as { sessionId: string; model: string };
                sessionId = data.sessionId;

                console.log(`\n  ${c.orange}${c.bold}🐙 CoreBlow Chat${c.reset}`);
                console.log(`  ${c.dim}Session: ${sessionId}${c.reset}`);
                console.log(`  ${c.dim}Model: ${data.model}${c.reset}`);
                console.log(`  ${c.dim}Type /help for commands, /quit to exit${c.reset}\n`);
            } catch (err) {
                console.log(`\n  ${c.red}✗ Failed to create session${c.reset}`);
                process.exit(1);
            }

            // REPL
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: `${c.cyan}you ▸ ${c.reset}`,
            });

            rl.prompt();

            rl.on('line', async (line: string) => {
                const input = line.trim();
                if (!input) { rl.prompt(); return; }

                // Commands
                if (input === '/quit' || input === '/exit' || input === '/q') {
                    console.log(`\n  ${c.dim}Goodbye! 👋${c.reset}\n`);
                    rl.close();
                    process.exit(0);
                }

                if (input === '/help') {
                    console.log(`  ${c.dim}Commands:${c.reset}`);
                    console.log(`  ${c.cyan}/new${c.reset}     — new session`);
                    console.log(`  ${c.cyan}/reset${c.reset}   — reset current session`);
                    console.log(`  ${c.cyan}/status${c.reset}  — show session info`);
                    console.log(`  ${c.cyan}/quit${c.reset}    — exit chat`);
                    rl.prompt();
                    return;
                }

                if (input === '/status') {
                    console.log(`  ${c.dim}Session: ${sessionId}${c.reset}`);
                    rl.prompt();
                    return;
                }

                if (input === '/new') {
                    try {
                        const res = await fetch(`${baseUrl}/api/sessions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ model: opts.model }),
                        });
                        const data = await res.json() as { sessionId: string };
                        sessionId = data.sessionId;
                        console.log(`  ${c.green}✓${c.reset} New session: ${sessionId}`);
                    } catch {
                        console.log(`  ${c.red}✗ Failed to create session${c.reset}`);
                    }
                    rl.prompt();
                    return;
                }

                // Send message
                process.stdout.write(`\n${c.orange}coreblow ▸ ${c.reset}`);

                try {
                    const res = await fetch(`${baseUrl}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: input, sessionId }),
                    });

                    const data = await res.json() as { text?: string; error?: string; usage?: { total: number }; durationMs?: number };

                    if (data.error) {
                        console.log(`${c.red}${data.error}${c.reset}`);
                    } else {
                        console.log(`${data.text ?? ''}`);
                        if (data.usage) {
                            console.log(`${c.dim}  [${data.usage.total} tokens, ${data.durationMs}ms]${c.reset}`);
                        }
                    }
                } catch (err) {
                    console.log(`${c.red}Error: ${err instanceof Error ? err.message : String(err)}${c.reset}`);
                }

                console.log();
                rl.prompt();
            });

            rl.on('close', () => {
                process.exit(0);
            });
        });
}
