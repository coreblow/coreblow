/**
 * CoreBlow CLI Entrypoint
 *
 * Main CLI setup: argument parsing, interactive REPL mode,
 * command routing, and graceful shutdown. This is the interface
 * users interact with when running CoreBlow from the terminal.
 */

import * as readline from 'node:readline';
import { CommandDispatcher } from '../commands/dispatcher.js';
import type { CommandResult } from '../commands/dispatcher.js';

/** CLI configuration */
export interface CliConfig {
    /** Application name displayed in prompt */
    appName?: string;
    /** Version string */
    version?: string;
    /** Custom prompt string */
    prompt?: string;
    /** Greeting message on startup */
    greeting?: string;
    /** Disable interactive mode (script mode) */
    nonInteractive?: boolean;
}

/** Parsed CLI arguments */
export interface ParsedArgs {
    command?: string;
    args: string[];
    flags: Record<string, string | boolean>;
}

/**
 * CoreBlow CLI Entrypoint
 */
export class CliEntrypoint {
    private config: Required<CliConfig>;
    private dispatcher: CommandDispatcher;
    private rl: readline.Interface | null = null;
    private running = false;
    private onMessageHandler: ((message: string) => Promise<string>) | null = null;

    constructor(config?: CliConfig, dispatcher?: CommandDispatcher) {
        this.config = {
            appName: config?.appName ?? 'CoreBlow',
            version: config?.version ?? '1.0.0',
            prompt: config?.prompt ?? 'coreblow> ',
            greeting: config?.greeting ?? '',
            nonInteractive: config?.nonInteractive ?? false,
        };
        this.dispatcher = dispatcher ?? new CommandDispatcher();
    }

    /**
     * Set the handler for non-command messages (AI chat).
     */
    onMessage(handler: (message: string) => Promise<string>): void {
        this.onMessageHandler = handler;
    }

    /**
     * Parse command-line arguments.
     */
    parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
        const result: ParsedArgs = { args: [], flags: {} };

        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i]!;
            if (arg.startsWith('--')) {
                const eqIndex = arg.indexOf('=');
                if (eqIndex > 0) {
                    result.flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
                } else {
                    result.flags[arg.slice(2)] = true;
                }
            } else if (arg.startsWith('-') && arg.length === 2) {
                result.flags[arg.slice(1)] = true;
            } else if (!result.command) {
                result.command = arg;
            } else {
                result.args.push(arg);
            }
        }

        return result;
    }

    /**
     * Start the CLI.
     */
    async start(): Promise<void> {
        const args = this.parseArgs();

        // Handle --version
        if (args.flags['version'] || args.flags['v']) {
            console.log(`${this.config.appName} v${this.config.version}`);
            return;
        }

        // Handle --help
        if (args.flags['help'] || args.flags['h']) {
            this.printHelp();
            return;
        }

        // Non-interactive: run a single command
        if (this.config.nonInteractive && args.command) {
            const result = await this.dispatcher.dispatch(`/${args.command} ${args.args.join(' ')}`);
            if (result.output) console.log(result.output);
            if (result.error) console.error(result.error);
            return;
        }

        // Interactive REPL mode
        await this.startRepl();
    }

    /**
     * Start the interactive REPL.
     */
    async startRepl(): Promise<void> {
        this.running = true;

        // Print greeting
        if (this.config.greeting) {
            console.log(this.config.greeting);
        } else {
            console.log(`\n  ⚡ ${this.config.appName} v${this.config.version}`);
            console.log('  Type /help for commands, or just chat.\n');
        }

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: this.config.prompt,
        });

        this.rl.prompt();

        this.rl.on('line', async (line: string) => {
            const input = line.trim();
            if (!input) {
                this.rl?.prompt();
                return;
            }

            // Handle exit
            if (input === '/exit' || input === '/quit' || input === '/q') {
                this.stop();
                return;
            }

            // Handle commands
            if (this.dispatcher.isCommand(input)) {
                const result = await this.dispatcher.dispatch(input, { isOwner: true });
                this.printResult(result);
            } else {
                // Chat message → AI handler
                if (this.onMessageHandler) {
                    try {
                        const response = await this.onMessageHandler(input);
                        console.log(`\n${response}\n`);
                    } catch (err) {
                        console.error(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
                    }
                } else {
                    console.log('\n[No AI handler configured. Use /help for commands.]\n');
                }
            }

            if (this.running) {
                this.rl?.prompt();
            }
        });

        this.rl.on('close', () => {
            this.running = false;
        });

        // Graceful shutdown
        process.on('SIGINT', () => this.stop());
    }

    /**
     * Stop the CLI.
     */
    stop(): void {
        this.running = false;
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
        console.log('\nGoodbye! 👋\n');
    }

    /**
     * Get the command dispatcher (for adding custom commands).
     */
    getDispatcher(): CommandDispatcher {
        return this.dispatcher;
    }

    // === Private ===

    private printResult(result: CommandResult): void {
        if (result.error) {
            console.error(`\n❌ ${result.error}\n`);
        } else if (result.output) {
            console.log(`\n${result.output}\n`);
        }
    }

    private printHelp(): void {
        console.log(`
  ${this.config.appName} v${this.config.version}

  Usage: coreblow [command] [options]

  Commands:
    chat              Start interactive chat (default)
    status            Show system status
    doctor            Run diagnostics

  Options:
    --help, -h        Show this help
    --version, -v     Show version
    --model=<model>   Set the AI model
    --port=<port>     Set the gateway port
`);
    }
}
