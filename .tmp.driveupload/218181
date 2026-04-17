import type { CommandMatch } from '../commands-registry.types.js';
import { commands } from './commands.data.js';
export function matchCommand(text: string): CommandMatch | null {
    if (!text.startsWith('/')) return null;
    const [cmd, ...rest] = text.slice(1).split(/\s+/);
    if (!cmd || !commands.has(cmd)) return null;
    return { name: cmd, args: rest.join(' ') };
}
