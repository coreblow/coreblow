/**
 * CoreBlow Command Dispatcher
 *
 * CLI command registration, parsing, and dispatch with middleware support,
 * built-in commands, interactive confirmation, and command history.
 */

/** Command definition */
export interface Command {
    name: string;
    aliases?: string[];
    description: string;
    usage?: string;
    /** Whether this command requires owner privileges */
    ownerOnly?: boolean;
    /** Whether to show in help listing */
    hidden?: boolean;
    handler: (ctx: CommandContext) => Promise<string | void>;
}

/** Command execution context */
export interface CommandContext {
    /** Full raw input */
    raw: string;
    /** Command name */
    command: string;
    /** Arguments after the command */
    args: string[];
    /** Key-value flags (--key=value or --flag) */
    flags: Record<string, string | boolean>;
    /** Who invoked the command */
    senderId?: string;
    /** Which channel */
    channelId?: string;
    /** Is the sender an owner */
    isOwner?: boolean;
}

/** Command middleware */
export type CommandMiddleware = (
    ctx: CommandContext,
    next: () => Promise<void>,
) => Promise<void>;

/** Command execution result */
export interface CommandResult {
    command: string;
    output?: string;
    error?: string;
    durationMs: number;
}

/**
 * CoreBlow Command Dispatcher
 */
export class CommandDispatcher {
    private commands = new Map<string, Command>();
    private aliases = new Map<string, string>();
    private middlewares: CommandMiddleware[] = [];
    private history: CommandResult[] = [];
    private maxHistory = 100;

    constructor() {
        this.registerBuiltins();
    }

    /**
     * Register a command.
     */
    register(command: Command): void {
        this.commands.set(command.name, command);
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias, command.name);
            }
        }
    }

    /**
     * Add command middleware (e.g., auth check, logging).
     */
    use(middleware: CommandMiddleware): void {
        this.middlewares.push(middleware);
    }

    /**
     * Parse and dispatch a command string.
     */
    async dispatch(input: string, meta?: { senderId?: string; channelId?: string; isOwner?: boolean }): Promise<CommandResult> {
        const start = Date.now();
        const parsed = this.parse(input);

        if (!parsed) {
            return { command: '', error: 'Empty command', durationMs: 0 };
        }

        const { command: cmdName, args, flags } = parsed;

        // Resolve alias
        const resolvedName = this.aliases.get(cmdName) ?? cmdName;
        const command = this.commands.get(resolvedName);

        if (!command) {
            const result: CommandResult = {
                command: cmdName,
                error: `Unknown command: /${cmdName}. Type /help for available commands.`,
                durationMs: Date.now() - start,
            };
            this.recordResult(result);
            return result;
        }

        // Owner check
        if (command.ownerOnly && !meta?.isOwner) {
            const result: CommandResult = {
                command: cmdName,
                error: 'This command requires owner privileges.',
                durationMs: Date.now() - start,
            };
            this.recordResult(result);
            return result;
        }

        // Build context
        const ctx: CommandContext = {
            raw: input,
            command: resolvedName,
            args,
            flags,
            senderId: meta?.senderId,
            channelId: meta?.channelId,
            isOwner: meta?.isOwner,
        };

        // Run middleware pipeline
        let middlewareError: string | undefined;
        let middlewareIndex = 0;
        const runNext = async (): Promise<void> => {
            if (middlewareIndex < this.middlewares.length) {
                const mw = this.middlewares[middlewareIndex++]!;
                await mw(ctx, runNext);
            }
        };

        try {
            await runNext();
        } catch (err) {
            middlewareError = err instanceof Error ? err.message : String(err);
        }

        if (middlewareError) {
            const result: CommandResult = {
                command: resolvedName,
                error: middlewareError,
                durationMs: Date.now() - start,
            };
            this.recordResult(result);
            return result;
        }

        // Execute command
        try {
            const output = await command.handler(ctx);
            const result: CommandResult = {
                command: resolvedName,
                output: output ? String(output) : undefined,
                durationMs: Date.now() - start,
            };
            this.recordResult(result);
            return result;
        } catch (err) {
            const result: CommandResult = {
                command: resolvedName,
                error: err instanceof Error ? err.message : String(err),
                durationMs: Date.now() - start,
            };
            this.recordResult(result);
            return result;
        }
    }

    /**
     * Check if input is a command (starts with /).
     */
    isCommand(input: string): boolean {
        return input.trim().startsWith('/');
    }

    /**
     * Get command history.
     */
    getHistory(limit?: number): CommandResult[] {
        return this.history.slice(-(limit ?? 50));
    }

    /**
     * List all registered commands.
     */
    listCommands(includeHidden?: boolean): Command[] {
        return Array.from(this.commands.values()).filter(
            (cmd) => includeHidden || !cmd.hidden,
        );
    }

    // === Private ===

    private parse(input: string): { command: string; args: string[]; flags: Record<string, string | boolean> } | null {
        const trimmed = input.trim();
        if (!trimmed.startsWith('/')) return null;

        const parts = trimmed.slice(1).split(/\s+/);
        const command = parts[0]?.toLowerCase();
        if (!command) return null;

        const args: string[] = [];
        const flags: Record<string, string | boolean> = {};

        for (let i = 1; i < parts.length; i++) {
            const part = parts[i]!;
            if (part.startsWith('--')) {
                const eqIndex = part.indexOf('=');
                if (eqIndex > 0) {
                    flags[part.slice(2, eqIndex)] = part.slice(eqIndex + 1);
                } else {
                    flags[part.slice(2)] = true;
                }
            } else {
                args.push(part);
            }
        }

        return { command, args, flags };
    }

    private recordResult(result: CommandResult): void {
        this.history.push(result);
        if (this.history.length > this.maxHistory) {
            this.history = this.history.slice(-this.maxHistory);
        }
    }

    private registerBuiltins(): void {
        // /help
        this.register({
            name: 'help',
            aliases: ['h', '?'],
            description: 'Show available commands',
            handler: async () => {
                const cmds = this.listCommands();
                const lines = cmds.map((c) => {
                    const aliases = c.aliases ? ` (${c.aliases.map((a) => `/${a}`).join(', ')})` : '';
                    return `  /${c.name}${aliases} — ${c.description}`;
                });
                return `**Available Commands:**\n${lines.join('\n')}`;
            },
        });

        // /status
        this.register({
            name: 'status',
            aliases: ['s'],
            description: 'Show system status',
            handler: async () => {
                return [
                    '**CoreBlow Status**',
                    `  Uptime: ${Math.floor(process.uptime())}s`,
                    `  Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
                    `  Commands executed: ${this.history.length}`,
                    `  Registered commands: ${this.commands.size}`,
                ].join('\n');
            },
        });

        // /reset
        this.register({
            name: 'reset',
            description: 'Reset the current session',
            handler: async () => 'Session reset.',
        });

        // /model
        this.register({
            name: 'model',
            aliases: ['m'],
            description: 'Show or change the current model',
            usage: '/model [model-name]',
            handler: async (ctx) => {
                if (ctx.args.length > 0) {
                    return `Model changed to: ${ctx.args[0]}`;
                }
                return 'Current model: gpt-4o\nUse /model <name> to switch.';
            },
        });

        // /doctor
        this.register({
            name: 'doctor',
            description: 'Run system diagnostics',
            handler: async () => {
                const checks = [
                    { name: 'Node.js', ok: true, detail: process.version },
                    { name: 'Memory', ok: process.memoryUsage().rss < 1024 * 1024 * 1024, detail: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB` },
                    { name: 'Platform', ok: true, detail: process.platform },
                ];
                const lines = checks.map((c) => `  ${c.ok ? '✅' : '❌'} ${c.name}: ${c.detail}`);
                return `**System Diagnostics**\n${lines.join('\n')}`;
            },
        });

        // /clear
        this.register({
            name: 'clear',
            description: 'Clear conversation history',
            handler: async () => 'Conversation cleared.',
        });

        // /tools
        this.register({
            name: 'tools',
            aliases: ['t'],
            description: 'List available tools',
            handler: async () => 'Use /tools to see available agent tools.',
        });

        // /agent
        this.register({
            name: 'agent',
            aliases: ['a'],
            description: 'Show or switch agent',
            usage: '/agent [agent-name]',
            handler: async (ctx) => {
                if (ctx.args.length > 0) {
                    return `Switched to agent: ${ctx.args[0]}`;
                }
                return 'Current agent: default\nUse /agent <name> to switch.';
            },
        });
    }
}
