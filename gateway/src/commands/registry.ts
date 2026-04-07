/**
 * src/commands/registry.ts
 * Command registry + parser + executor
 * SUPERIOR: CoreBlow = 331 files scattered; CoreBlow = single registry with parser + permissions + help
 */

import { createChildLogger } from '../utils/logger.js';
import type {
    CommandDefinition,
    CommandHandler,
    CommandContext,
    CommandResult,
    ParsedCommand,
    CommandArgument,
    CommandFlag,
} from './types.js';

const log = createChildLogger('commands');

export class CommandRegistry {
    private commands = new Map<string, CommandDefinition>();
    private aliases = new Map<string, string>(); // alias → command name
    private prefix: string;
    private history: { command: string; userId: string; channel: string; timestamp: number; success: boolean }[] = [];

    constructor(prefix: string = '/') {
        this.prefix = prefix;
    }

    /**
     * Register a command
     */
    register(definition: CommandDefinition): void {
        this.commands.set(definition.name, definition);

        // Register aliases
        if (definition.aliases) {
            for (const alias of definition.aliases) {
                this.aliases.set(alias, definition.name);
            }
        }

        // Register subcommands
        if (definition.subcommands) {
            for (const sub of definition.subcommands) {
                const fullName = `${definition.name} ${sub.name}`;
                this.commands.set(fullName, { ...sub, name: fullName, category: definition.category });
            }
        }

        log.debug({ name: definition.name, category: definition.category }, 'Command registered');
    }

    /**
     * Unregister a command
     */
    unregister(name: string): boolean {
        const cmd = this.commands.get(name);
        if (!cmd) return false;

        // Remove aliases
        if (cmd.aliases) {
            for (const alias of cmd.aliases) {
                this.aliases.delete(alias);
            }
        }

        return this.commands.delete(name);
    }

    /**
     * Check if text is a command
     */
    isCommand(text: string): boolean {
        return text.trim().startsWith(this.prefix);
    }

    /**
     * Parse a command string into structured data
     * Supports: /command arg1 arg2 --flag value --bool-flag
     */
    parse(text: string): ParsedCommand | null {
        const trimmed = text.trim();
        if (!trimmed.startsWith(this.prefix)) return null;

        const withoutPrefix = trimmed.slice(this.prefix.length);
        const tokens = this.tokenize(withoutPrefix);
        if (tokens.length === 0) return null;

        // Resolve command name (could be multi-word for subcommands)
        let commandName = tokens[0].toLowerCase();
        let startIdx = 1;

        // Check if next token forms a subcommand
        if (tokens.length > 1) {
            const sub = `${commandName} ${tokens[1].toLowerCase()}`;
            if (this.commands.has(sub)) {
                commandName = sub;
                startIdx = 2;
            }
        }

        // Resolve alias
        if (this.aliases.has(commandName)) {
            commandName = this.aliases.get(commandName)!;
        }

        const definition = this.commands.get(commandName);
        const args: Record<string, unknown> = {};
        const flags: Record<string, unknown> = {};

        if (definition) {
            // Parse positional args
            let argIdx = 0;
            for (let i = startIdx; i < tokens.length; i++) {
                const token = tokens[i];

                if (token.startsWith('--')) {
                    // Named flag
                    const flagName = token.slice(2);
                    const flagDef = definition.flags?.find(f => f.name === flagName || f.alias === flagName);

                    if (flagDef?.type === 'boolean') {
                        flags[flagName] = true;
                    } else if (i + 1 < tokens.length) {
                        const value = tokens[++i];
                        flags[flagName] = flagDef?.type === 'number' ? Number(value) : value;
                    }
                } else if (token.startsWith('-') && token.length === 2) {
                    // Short alias
                    const alias = token.slice(1);
                    const flagDef = definition.flags?.find(f => f.alias === alias);
                    if (flagDef) {
                        if (flagDef.type === 'boolean') {
                            flags[flagDef.name] = true;
                        } else if (i + 1 < tokens.length) {
                            const value = tokens[++i];
                            flags[flagDef.name] = flagDef.type === 'number' ? Number(value) : value;
                        }
                    }
                } else {
                    // Positional arg
                    const argDef = definition.args?.[argIdx];
                    if (argDef) {
                        args[argDef.name] = argDef.type === 'number' ? Number(token) : token;
                        argIdx++;
                    } else {
                        // Extra args go into a 'rest' bucket
                        args[`_${argIdx}`] = token;
                        argIdx++;
                    }
                }
            }

            // Apply defaults
            for (const argDef of definition.args || []) {
                if (!(argDef.name in args) && argDef.default !== undefined) {
                    args[argDef.name] = argDef.default;
                }
            }
            for (const flagDef of definition.flags || []) {
                if (!(flagDef.name in flags) && flagDef.default !== undefined) {
                    flags[flagDef.name] = flagDef.default;
                }
            }
        } else {
            // Unknown command — still parse basic args
            for (let i = startIdx; i < tokens.length; i++) {
                args[`_${i - startIdx}`] = tokens[i];
            }
        }

        return { name: commandName, args, flags, raw: trimmed };
    }

    /**
     * Execute a parsed command
     */
    async execute(parsed: ParsedCommand, context: Omit<CommandContext, 'command'>): Promise<CommandResult> {
        const start = Date.now();
        const definition = this.commands.get(parsed.name);

        if (!definition) {
            return {
                success: false,
                error: `Unknown command: ${this.prefix}${parsed.name}. Type ${this.prefix}help for available commands.`,
                durationMs: Date.now() - start,
            };
        }

        // Check permissions
        if (definition.permission === 'admin' || definition.permission === 'owner') {
            const userRole = (context.metadata?.role as string) || 'user';
            if (definition.permission === 'owner' && userRole !== 'owner') {
                return { success: false, error: 'This command requires owner permission.', durationMs: Date.now() - start };
            }
            if (definition.permission === 'admin' && userRole !== 'admin' && userRole !== 'owner') {
                return { success: false, error: 'This command requires admin permission.', durationMs: Date.now() - start };
            }
        }

        // Check channel restriction
        if (definition.channels?.length && !definition.channels.includes(context.channel)) {
            return { success: false, error: `Command not available in this channel.`, durationMs: Date.now() - start };
        }

        // Validate required args
        for (const argDef of definition.args || []) {
            if (argDef.required && !(argDef.name in parsed.args)) {
                return {
                    success: false,
                    error: `Missing required argument: ${argDef.name}\nUsage: ${definition.usage || `${this.prefix}${definition.name}`}`,
                    durationMs: Date.now() - start,
                };
            }
        }

        // Validate choices
        for (const argDef of definition.args || []) {
            if (argDef.choices && argDef.name in parsed.args) {
                const value = String(parsed.args[argDef.name]);
                if (!argDef.choices.includes(value)) {
                    return {
                        success: false,
                        error: `Invalid value for ${argDef.name}: "${value}". Must be one of: ${argDef.choices.join(', ')}`,
                        durationMs: Date.now() - start,
                    };
                }
            }
        }

        try {
            const fullContext: CommandContext = { ...context, command: parsed };
            const output = await definition.handler(fullContext);

            this.history.push({
                command: parsed.name,
                userId: context.senderId,
                channel: context.channel,
                timestamp: Date.now(),
                success: true,
            });

            return { success: true, output: output || undefined, durationMs: Date.now() - start };
        } catch (err: unknown) {
            this.history.push({
                command: parsed.name,
                userId: context.senderId,
                channel: context.channel,
                timestamp: Date.now(),
                success: false,
            });

            const msg = err instanceof Error ? err.message : String(err);
            log.error({ command: parsed.name, error: msg }, 'Command execution failed');
            return { success: false, error: `Error: ${msg}`, durationMs: Date.now() - start };
        }
    }

    /**
     * Convenience: parse + execute
     */
    async run(text: string, context: Omit<CommandContext, 'command'>): Promise<CommandResult | null> {
        const parsed = this.parse(text);
        if (!parsed) return null;
        return this.execute(parsed, context);
    }

    /**
     * Generate help text for all commands or a specific command
     */
    generateHelp(commandName?: string): string {
        if (commandName) {
            const cmd = this.commands.get(commandName) || this.commands.get(this.aliases.get(commandName) || '');
            if (!cmd) return `Unknown command: ${commandName}`;
            return this.formatCommandHelp(cmd);
        }

        // Group by category
        const categories = new Map<string, CommandDefinition[]>();
        for (const cmd of this.commands.values()) {
            if (cmd.hidden) continue;
            // Skip subcommands from top-level listing
            if (cmd.name.includes(' ')) continue;
            const cat = cmd.category || 'General';
            const list = categories.get(cat) || [];
            list.push(cmd);
            categories.set(cat, list);
        }

        const lines: string[] = ['📋 **Available Commands**\n'];

        for (const [category, commands] of [...categories.entries()].sort()) {
            lines.push(`**${category}**`);
            for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
                const aliases = cmd.aliases?.length ? ` (${cmd.aliases.map(a => this.prefix + a).join(', ')})` : '';
                lines.push(`  ${this.prefix}${cmd.name}${aliases} — ${cmd.description}`);
            }
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Get command list (for bot command registration)
     */
    getCommandList(): { name: string; description: string }[] {
        return [...this.commands.values()]
            .filter(c => !c.hidden && !c.name.includes(' '))
            .map(c => ({ name: c.name, description: c.description }));
    }

    /**
     * Get history
     */
    getHistory(limit: number = 50): typeof this.history {
        return this.history.slice(-limit);
    }

    /**
     * Get stats
     */
    getStats(): { totalCommands: number; totalAliases: number; totalExecutions: number; successRate: number } {
        const total = this.history.length;
        const success = this.history.filter(h => h.success).length;
        return {
            totalCommands: this.commands.size,
            totalAliases: this.aliases.size,
            totalExecutions: total,
            successRate: total > 0 ? Math.round((success / total) * 100) : 0,
        };
    }

    // ─── Private helpers ─────────────────────────────────────────

    private formatCommandHelp(cmd: CommandDefinition): string {
        const lines: string[] = [`**${this.prefix}${cmd.name}** — ${cmd.description}`];

        if (cmd.usage) lines.push(`Usage: \`${cmd.usage}\``);
        if (cmd.aliases?.length) lines.push(`Aliases: ${cmd.aliases.map(a => this.prefix + a).join(', ')}`);

        if (cmd.args?.length) {
            lines.push('\nArguments:');
            for (const arg of cmd.args) {
                const req = arg.required ? '(required)' : `(optional, default: ${arg.default ?? 'none'})`;
                const choices = arg.choices ? ` [${arg.choices.join('|')}]` : '';
                lines.push(`  ${arg.name}${choices} — ${arg.description} ${req}`);
            }
        }

        if (cmd.flags?.length) {
            lines.push('\nFlags:');
            for (const flag of cmd.flags) {
                const alias = flag.alias ? `|-${flag.alias}` : '';
                lines.push(`  --${flag.name}${alias} — ${flag.description} (${flag.type})`);
            }
        }

        if (cmd.subcommands?.length) {
            lines.push('\nSubcommands:');
            for (const sub of cmd.subcommands) {
                lines.push(`  ${this.prefix}${cmd.name} ${sub.name} — ${sub.description}`);
            }
        }

        if (cmd.permission) lines.push(`\nPermission: ${cmd.permission}`);

        return lines.join('\n');
    }

    private tokenize(input: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuote = false;
        let quoteChar = '';

        for (const char of input) {
            if (inQuote) {
                if (char === quoteChar) {
                    inQuote = false;
                    tokens.push(current);
                    current = '';
                } else {
                    current += char;
                }
            } else if (char === '"' || char === "'") {
                inQuote = true;
                quoteChar = char;
            } else if (char === ' ' || char === '\t') {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) tokens.push(current);
        return tokens;
    }
}
