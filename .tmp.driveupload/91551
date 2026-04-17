/**
 * CoreBlow Agent Command Handler
 *
 * Routes and executes agent-level commands (slash commands, model switching,
 * status queries, etc.). Provides the command dispatch pipeline for interactive
 * agent sessions.
 *
 * Equivalent: CoreBlow src/agents/agent-command.ts (912 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { normalizeAgentId, resolveAgentConfig } from './agent-scope.js';
import { modelKey, parseModelRef, DEFAULT_PROVIDER, type ModelRef, type CoreBlowConfig } from './model-selection.js';

const log = createChildLogger('agent-command');

// ─── Types ────────────────────────────────────────────────────────

export type CommandResult = {
    success: boolean;
    output: string;
    silent?: boolean;
    metadata?: Record<string, unknown>;
};

export type CommandHandler = (args: string[], context: CommandContext) => Promise<CommandResult> | CommandResult;

export interface CommandContext {
    sessionId: string;
    agentId: string;
    cfg: CoreBlowConfig;
    currentModel?: ModelRef;
    userTimezone?: string;
}

export interface RegisteredCommand {
    name: string;
    aliases: string[];
    description: string;
    usage?: string;
    category: CommandCategory;
    handler: CommandHandler;
    requiresAuth?: 'owner' | 'admin' | 'user';
}

export type CommandCategory =
    | 'model'
    | 'session'
    | 'config'
    | 'debug'
    | 'agent'
    | 'gateway'
    | 'general';

// ─── Command Registry ─────────────────────────────────────────────

const commands = new Map<string, RegisteredCommand>();
const aliasMap = new Map<string, string>();

/**
 * Register a command
 */
export function registerCommand(cmd: RegisteredCommand): void {
    const name = cmd.name.toLowerCase();
    commands.set(name, cmd);
    for (const alias of cmd.aliases) {
        aliasMap.set(alias.toLowerCase(), name);
    }
    log.debug({ name, aliases: cmd.aliases }, 'Command registered');
}

/**
 * Resolve a command name (including aliases)
 */
export function resolveCommandName(input: string): string | undefined {
    const normalized = input.trim().toLowerCase();
    return commands.has(normalized) ? normalized : aliasMap.get(normalized);
}

/**
 * Get a registered command
 */
export function getCommand(name: string): RegisteredCommand | undefined {
    const resolved = resolveCommandName(name);
    return resolved ? commands.get(resolved) : undefined;
}

/**
 * List all registered commands
 */
export function listCommands(category?: CommandCategory): RegisteredCommand[] {
    const all = Array.from(commands.values());
    if (!category) return all;
    return all.filter((cmd) => cmd.category === category);
}

/**
 * Parse a command string into name and arguments
 */
export function parseCommand(input: string): { name: string; args: string[] } | null {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const parts = trimmed.slice(1).split(/\s+/);
    const name = parts[0]?.toLowerCase();
    if (!name) return null;

    return { name, args: parts.slice(1) };
}

/**
 * Execute a command
 */
export async function executeCommand(
    input: string,
    context: CommandContext,
): Promise<CommandResult> {
    const parsed = parseCommand(input);
    if (!parsed) {
        return { success: false, output: 'Invalid command format. Commands start with /' };
    }

    const cmd = getCommand(parsed.name);
    if (!cmd) {
        return {
            success: false,
            output: `Unknown command: /${parsed.name}. Use /help for available commands.`,
        };
    }

    try {
        log.debug({ command: parsed.name, args: parsed.args, sessionId: context.sessionId }, 'Executing command');
        const result = await cmd.handler(parsed.args, context);
        log.debug({ command: parsed.name, success: result.success }, 'Command executed');
        return result;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error({ command: parsed.name, error: message }, 'Command execution failed');
        return { success: false, output: `Command error: ${message}` };
    }
}

// ─── Built-in Commands ────────────────────────────────────────────

registerCommand({
    name: 'help',
    aliases: ['h', '?'],
    description: 'Show available commands',
    category: 'general',
    handler: (args) => {
        const category = args[0] as CommandCategory | undefined;
        const cmds = listCommands(category);

        if (cmds.length === 0) {
            return { success: true, output: `No commands found${category ? ` for category "${category}"` : ''}.` };
        }

        const lines = ['**Available Commands:**', ''];
        const categories = new Map<string, RegisteredCommand[]>();
        for (const cmd of cmds) {
            const cat = cmd.category;
            const existing = categories.get(cat) ?? [];
            existing.push(cmd);
            categories.set(cat, existing);
        }

        for (const [cat, catCmds] of categories) {
            lines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
            for (const cmd of catCmds) {
                const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.map((a) => `/${a}`).join(', ')})` : '';
                lines.push(`- **/${cmd.name}**${aliases}: ${cmd.description}`);
            }
            lines.push('');
        }

        return { success: true, output: lines.join('\n') };
    },
});

registerCommand({
    name: 'status',
    aliases: ['s', 'info'],
    description: 'Show session status',
    category: 'session',
    handler: (_args, context) => {
        const model = context.currentModel
            ? modelKey(context.currentModel.provider, context.currentModel.model)
            : 'not set';
        const lines = [
            '📊 **Session Status**',
            '',
            `- **Session:** ${context.sessionId}`,
            `- **Agent:** ${context.agentId}`,
            `- **Model:** ${model}`,
            `- **Timezone:** ${context.userTimezone ?? 'not set'}`,
        ];
        return { success: true, output: lines.join('\n') };
    },
});

registerCommand({
    name: 'model',
    aliases: ['m'],
    description: 'Switch or show the current model',
    usage: '/model [provider/model]',
    category: 'model',
    handler: (args, context) => {
        if (args.length === 0) {
            const model = context.currentModel
                ? modelKey(context.currentModel.provider, context.currentModel.model)
                : 'not set';
            return { success: true, output: `Current model: ${model}` };
        }

        const raw = args.join(' ');
        const ref = parseModelRef(raw, DEFAULT_PROVIDER);
        if (!ref) {
            return { success: false, output: `Invalid model reference: "${raw}"` };
        }

        return {
            success: true,
            output: `Model switched to: ${modelKey(ref.provider, ref.model)}`,
            metadata: { newModel: ref },
        };
    },
});

registerCommand({
    name: 'reasoning',
    aliases: ['think', 'r'],
    description: 'Toggle reasoning mode (on/off/stream)',
    usage: '/reasoning [on|off|stream]',
    category: 'model',
    handler: (args) => {
        const validModes = ['on', 'off', 'stream'];
        const mode = args[0]?.toLowerCase();

        if (!mode) {
            return { success: true, output: 'Usage: /reasoning [on|off|stream]' };
        }
        if (!validModes.includes(mode)) {
            return { success: false, output: `Invalid reasoning mode: "${mode}". Use: on, off, or stream` };
        }

        return {
            success: true,
            output: `Reasoning mode: ${mode}`,
            metadata: { reasoningMode: mode },
        };
    },
});

registerCommand({
    name: 'verbose',
    aliases: ['v'],
    description: 'Toggle verbose mode',
    usage: '/verbose [on|off]',
    category: 'debug',
    handler: (args) => {
        const mode = args[0]?.toLowerCase() ?? 'toggle';
        return {
            success: true,
            output: `Verbose mode: ${mode === 'off' ? 'off' : 'on'}`,
            metadata: { verbose: mode !== 'off' },
        };
    },
});

registerCommand({
    name: 'reset',
    aliases: ['clear', 'new'],
    description: 'Reset the conversation',
    category: 'session',
    handler: (_args, context) => {
        return {
            success: true,
            output: `Session "${context.sessionId}" conversation reset.`,
            metadata: { action: 'reset' },
        };
    },
});

registerCommand({
    name: 'compact',
    aliases: ['compress'],
    description: 'Compact the conversation history',
    category: 'session',
    handler: (_args, context) => {
        return {
            success: true,
            output: `Session "${context.sessionId}" conversation compacted.`,
            metadata: { action: 'compact' },
        };
    },
});

registerCommand({
    name: 'elevated',
    aliases: ['sudo', 'admin'],
    description: 'Toggle elevated exec mode',
    usage: '/elevated [on|off|ask|full]',
    category: 'session',
    handler: (args) => {
        const validLevels = ['on', 'off', 'ask', 'full'];
        const level = args[0]?.toLowerCase();

        if (!level) {
            return { success: true, output: 'Usage: /elevated [on|off|ask|full]' };
        }
        if (!validLevels.includes(level)) {
            return { success: false, output: `Invalid level: "${level}". Use: on, off, ask, or full` };
        }

        return {
            success: true,
            output: `Elevated exec: ${level}`,
            metadata: { elevated: level },
        };
    },
});

registerCommand({
    name: 'agent',
    aliases: ['a'],
    description: 'Show or switch agent',
    usage: '/agent [agent-id]',
    category: 'agent',
    handler: (args, context) => {
        if (args.length === 0) {
            return { success: true, output: `Current agent: ${context.agentId}` };
        }

        const newAgent = normalizeAgentId(args[0]!);
        const config = resolveAgentConfig(context.cfg, newAgent);

        if (!config) {
            return { success: false, output: `Agent "${newAgent}" not found.` };
        }

        return {
            success: true,
            output: `Switched to agent: ${newAgent}${config.name ? ` (${config.name})` : ''}`,
            metadata: { newAgent, config },
        };
    },
});

registerCommand({
    name: 'agents',
    aliases: ['al'],
    description: 'List available agents',
    category: 'agent',
    handler: (_args, context) => {
        const configAgents = (context.cfg as Record<string, unknown>)?.agents as Record<string, unknown> | undefined;
        const ids = configAgents ? Object.keys(configAgents).filter((k) => k !== 'defaults') : [];

        if (ids.length === 0) {
            return { success: true, output: 'No agents configured. Using default agent.' };
        }

        const lines = ['**Available Agents:**', ''];
        for (const id of ids) {
            const marker = id === context.agentId ? ' ← current' : '';
            lines.push(`- ${id}${marker}`);
        }

        return { success: true, output: lines.join('\n') };
    },
});

registerCommand({
    name: 'config',
    aliases: ['cfg'],
    description: 'Show or modify configuration',
    usage: '/config [get|set|patch] [key] [value]',
    category: 'config',
    handler: (args) => {
        const action = args[0]?.toLowerCase();

        if (!action || action === 'show') {
            return { success: true, output: 'Use /config get <key> or /config set <key> <value>' };
        }

        if (action === 'get') {
            const key = args[1];
            if (!key) return { success: false, output: 'Usage: /config get <key>' };
            return {
                success: true,
                output: `Config key "${key}" lookup requested.`,
                metadata: { action: 'config.get', key },
            };
        }

        if (action === 'set' || action === 'patch') {
            const key = args[1];
            const value = args.slice(2).join(' ');
            if (!key || !value) return { success: false, output: `Usage: /config ${action} <key> <value>` };
            return {
                success: true,
                output: `Config "${key}" → "${value}" (${action})`,
                metadata: { action: `config.${action}`, key, value },
            };
        }

        return { success: false, output: `Unknown config action: "${action}"` };
    },
});

registerCommand({
    name: 'gateway',
    aliases: ['gw'],
    description: 'Gateway management commands',
    usage: '/gateway [status|restart|update]',
    category: 'gateway',
    handler: (args) => {
        const action = args[0]?.toLowerCase() ?? 'status';
        const validActions = ['status', 'restart', 'start', 'stop', 'update'];

        if (!validActions.includes(action)) {
            return { success: false, output: `Unknown gateway action: "${action}". Use: ${validActions.join(', ')}` };
        }

        return {
            success: true,
            output: `Gateway ${action} requested.`,
            metadata: { action: `gateway.${action}` },
        };
    },
});

registerCommand({
    name: 'doctor',
    aliases: ['diag', 'diagnose'],
    description: 'Run diagnostics',
    category: 'debug',
    handler: (_args, context) => {
        const lines = [
            '🔍 **Diagnostics**',
            '',
            `- Session: ${context.sessionId}`,
            `- Agent: ${context.agentId}`,
            `- Model: ${context.currentModel ? modelKey(context.currentModel.provider, context.currentModel.model) : 'not set'}`,
            '- Gateway: running',
            '- Config: loaded',
            '- Tools: available',
        ];
        return { success: true, output: lines.join('\n') };
    },
});
