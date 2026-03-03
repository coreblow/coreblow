/**
 * commands/handlers/session.ts — Session management commands
 */
import type { CommandContext } from '../types.js';

export async function handleSessionList(ctx: CommandContext): Promise<string> {
    return '📋 Active sessions:\n  • Current: `' + ctx.sessionId + '` (' + ctx.channel + ')';
}

export async function handleSessionClear(ctx: CommandContext): Promise<string> {
    return '🗑️ Session `' + ctx.sessionId + '` cleared.';
}

export async function handleSessionExport(ctx: CommandContext): Promise<string> {
    return '📦 Session exported. Download at /api/sessions/' + ctx.sessionId + '/export';
}

export async function handleSessionSwitch(ctx: CommandContext): Promise<string> {
    const target = ctx.command.args.id as string | undefined;
    if (!target) return 'Usage: /session switch <id>';
    return '✅ Switched to session `' + target + '`.';
}
