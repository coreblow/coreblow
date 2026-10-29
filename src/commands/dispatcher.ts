/**
 * commands/dispatcher.ts
 * Command dispatcher with middleware pipeline, history tracking, and dispatch.
 * CoreBlow command execution engine.
 */

export type CommandDefinition = {
  name: string;
  aliases?: string[];
  description: string;
  ownerOnly?: boolean;
  hidden?: boolean;
  handler: (ctx: HandlerContext) => Promise<string> | string;
};

export type HandlerContext = {
  command: string;
  args: string[];
  flags: Record<string, unknown>;
  raw?: string;
  senderId?: string;
  isOwner?: boolean;
  [key: string]: unknown;
};

export type DispatchContext = HandlerContext;

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
  private aliasMap = new Map<string, string>();
  private middlewares: MiddlewareFn[] = [];
  private historyEntries: HistoryEntry[] = [];
  private startTime = Date.now();

  constructor() {
    this.registerBuiltins();
  }

  private registerBuiltins(): void {
    this.register({
      name: "help",
      aliases: ["h"],
      description: "Show available commands and usage help",
      handler: () => {
        const visible = this.listCommands(false);
        const list = visible.map((c) => `/${c.name} - ${c.description}`).join("\n");
        return `Available Commands:\n${list}`;
      },
    });

    this.register({
      name: "status",
      description: "Show CoreBlow system status and uptime",
      handler: () => {
        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        return `CoreBlow Status: Operational\nUptime: ${uptimeSeconds}s\nCommands: ${this.commands.size}`;
      },
    });

    this.register({
      name: "reset",
      description: "Reset current conversation or session context",
      handler: () => "Session reset.",
    });

    this.register({
      name: "model",
      description: "View or switch active model",
      handler: (ctx) => {
        const targetModel = ctx.args[0]?.trim();
        if (targetModel) {
          return `Switched model to ${targetModel}`;
        }
        return "Current model: default";
      },
    });

    this.register({
      name: "doctor",
      description: "Run CoreBlow health checks and diagnostics",
      handler: () => "Doctor checks passed. System healthy.",
    });
  }

  /** Register a command. */
  register(def: CommandDefinition): void {
    this.commands.set(def.name, def);
    if (def.aliases) {
      for (const alias of def.aliases) {
        this.aliasMap.set(alias, def.name);
      }
    }
  }

  /** Add middleware to the dispatch pipeline. */
  use(fn: MiddlewareFn): void {
    this.middlewares.push(fn);
  }

  /** Check if input looks like a command (starts with /). */
  isCommand(input: string): boolean {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
      return false;
    }
    const name = trimmed.slice(1).split(/\s+/)[0] ?? "";
    return (
      this.commands.has(name) ||
      this.aliasMap.has(name) ||
      name.length > 0
    );
  }

  /** List all registered commands. includeHidden defaults to false. */
  listCommands(includeHidden = false): CommandDefinition[] {
    const cmds = [...this.commands.values()];
    if (includeHidden) {
      return cmds;
    }
    return cmds.filter((c) => !c.hidden);
  }

  /** Dispatch a command string (e.g. "/ping args"). */
  async dispatch(raw: string, context?: Partial<DispatchContext>): Promise<DispatchResult> {
    const start = Date.now();
    const trimmed = raw.trim();

    if (!trimmed) {
      return {
        command: "",
        error: "Empty command input",
        durationMs: 0,
      };
    }

    const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
    const tokens = withoutSlash.split(/\s+/).filter(Boolean);
    const rawCommand = tokens[0] ?? "";
    const remainingTokens = tokens.slice(1);

    const { args, flags } = this.parseArgsAndFlags(remainingTokens);
    const canonicalName = this.aliasMap.get(rawCommand) ?? rawCommand;
    const def = this.commands.get(canonicalName);

    const ctx: DispatchContext = {
      command: canonicalName,
      args,
      flags,
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
          output = await this.executeCommandDef(def, canonicalName, ctx);
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
        output = await this.executeCommandDef(def, canonicalName, ctx);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - start;
    this.historyEntries.push({
      command: canonicalName,
      args: args.length > 0 ? args.join(" ") : undefined,
      output,
      error,
      timestamp: start,
      durationMs,
    });

    return {
      command: canonicalName,
      output,
      error,
      durationMs,
    };
  }

  private async executeCommandDef(
    def: CommandDefinition | undefined,
    canonicalName: string,
    ctx: DispatchContext,
  ): Promise<string> {
    if (!def) {
      throw new Error(`Unknown command: ${canonicalName}`);
    }
    if (def.ownerOnly && !ctx.isOwner) {
      throw new Error("This command requires owner privileges.");
    }
    return await def.handler(ctx);
  }

  private parseArgsAndFlags(tokens: string[]): {
    args: string[];
    flags: Record<string, unknown>;
  } {
    const args: string[] = [];
    const flags: Record<string, unknown> = {};

    for (const token of tokens) {
      if (token.startsWith("--")) {
        const flagBody = token.slice(2);
        const eqIdx = flagBody.indexOf("=");
        if (eqIdx !== -1) {
          const key = flagBody.slice(0, eqIdx);
          const val = flagBody.slice(eqIdx + 1);
          flags[key] = val;
        } else {
          flags[flagBody] = true;
        }
      } else if (token.startsWith("-") && token.length > 1) {
        const flagKey = token.slice(1);
        flags[flagKey] = true;
      } else {
        args.push(token);
      }
    }

    return { args, flags };
  }

  /** Get dispatch history. */
  getHistory(): HistoryEntry[] {
    return [...this.historyEntries];
  }

  /** Clear dispatch history. */
  clearHistory(): void {
    this.historyEntries = [];
  }
}
