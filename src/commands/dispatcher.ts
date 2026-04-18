/**
 * commands/dispatcher.ts
 * Command dispatcher with middleware pipeline, history tracking, and dispatch.
 * CoreBlow command execution engine.
 */

export type CommandDefinition = {
    name: string;
    description: string;
    handler: (ctx: HandlerContext) => Promise<string> | string;
};

export type HandlerContext = {
    command: string;
    args: string[];
    raw?: string;
    senderId?: string;
    [key: string]: unknown;
};

export type DispatchContext = {
    command: string;
    args: string[];
    raw?: string;
    senderId?: string;
    [key: string]: unknown;
};

export type DispatchResult = {
    command: string;
    output?: string;
    error?: string;
    durationMs: number;
};

/** Alias for backward compatibility */
export type CommandResult = DispatchResult;

export type HistoryEntry = {
    command: string;
    args?: string;
    output?: string;
    error?: string;
    timestamp: number;
    durationMs: number;
};

type MiddlewareFn = (
    ctx: DispatchContext,
    next: () => Promise<void>,
) => Promise<void>;

export class CommandDispatcher {
    private commands = new Map<string, CommandDefinition>();
    private middlewares: MiddlewareFn[] = [];
    private historyEntries: HistoryEntry[] = [];

    /** Register a command. */
    register(def: CommandDefinition): void {
        this.commands.set(def.name, def);
    }

    /** Add middleware to the dispatch pipeline. */
    use(fn: MiddlewareFn): void {
        this.middlewares.push(fn);
    }

    /** Check if input looks like a command (starts with /). */
    isCommand(input: string): boolean {
        const trimmed = input.trim();
        if (!trimmed.startsWith('/')) return false;
        const name = trimmed.slice(1).split(/\s+/)[0] ?? '';
        return this.commands.has(name) || name === 'help' || name === 'status' || name === 'exit' || name === 'quit' || name === 'q';
    }

    /** List all registered commands. */
    listCommands(includeBuiltins = false): CommandDefinition[] {
        const cmds = [...this.commands.values()];
        if (includeBuiltins) {
            const names = new Set(this.commands.keys());
            if (!names.has('help')) {
                cmds.push({
                    name: 'help', description: 'Show help',
                    handler: () => 'Available commands: ' + [...this.commands.keys()].join(', '),
                });
            }
            if (!names.has('status')) {
                cmds.push({
                    name: 'status', description: 'Show status',
                    handler: () => 'ok',
                });
            }
        }
        return cmds;
    }

    /** Dispatch a command string (e.g. "/ping args"). */
    async dispatch(raw: string, context?: Partial<DispatchContext>): Promise<DispatchResult> {
        const trimmed = raw.trim();
        const withoutSlash = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
        const parts = withoutSlash.split(/\s+/).filter(Boolean);
        const commandName = parts[0] ?? '';
        const args = parts.slice(1);

        const start = Date.now();
        const ctx: DispatchContext = {
            command: commandName,
            args,
            raw: trimmed,
            ...context,
        };

        let output: string | undefined;
        let error: string | undefined;

        try {
            if (this.middlewares.length > 0) {
                let handlerCalled = false;
                const executeHandler = async (): Promise<void> => {
                    if (handlerCalled) return;
                    handlerCalled = true;
                    output = await this.executeCommand(commandName, ctx);
                };

                const runMiddleware = async (index: number): Promise<void> => {
                    if (index < this.middlewares.length) {
                        await this.middlewares[index](ctx, () => runMiddleware(index + 1));
                    } else {
                        await executeHandler();
                    }
                };
                await runMiddleware(0);
            } else {
                output = await this.executeCommand(commandName, ctx);
            }
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
        }

        const durationMs = Date.now() - start;
        this.historyEntries.push({
            command: commandName,
            args: args.length > 0 ? args.join(' ') : undefined,
            output,
            error,
            timestamp: start,
            durationMs,
        });

        return { command: commandName, output, error, durationMs };
    }

    /** Get dispatch history. */
    getHistory(): HistoryEntry[] {
        return [...this.historyEntries];
    }

    /** Clear dispatch history. */
    clearHistory(): void {
        this.historyEntries = [];
    }

    private async executeCommand(name: string, ctx: DispatchContext): Promise<string> {
        const def = this.commands.get(name);
        if (def) {
            return await def.handler(ctx);
        }
        return await this.handleBuiltin(name);
    }

    private async handleBuiltin(name: string): Promise<string> {
        if (name === 'help') {
            return 'Available commands: ' + [...this.commands.keys()].join(', ');
        }
        if (name === 'status') {
            return 'ok';
        }
        return `Unknown command: ${name}`;
    }
}
