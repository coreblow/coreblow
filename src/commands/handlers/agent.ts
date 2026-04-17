/**
 * commands/handlers/agent.ts — Agent management commands
 */
import type { CommandContext } from '../types.js';

export async function handleAgentList(ctx: CommandContext): Promise<string> {
    return '🤖 Configured agents:\n  • default — Primary agent';
}

export async function handleAgentSwitch(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /agent switch <name>';
    return `✅ Switched to agent \`${name}\`.`;
}

export async function handleAgentConfig(ctx: CommandContext): Promise<string> {
    return '🤖 Agent Config:\n  • Model: auto\n  • Thinking: medium\n  • Tools: default profile';
}

export async function handleAgentPersona(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /agent persona <name>\nAvailable: default, coding, creative, teacher';
    return `✅ Agent persona set to \`${name}\`.`;
}
