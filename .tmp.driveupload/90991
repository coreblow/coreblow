import type { CommandDefinition } from '../commands-registry.types.js';
import { commands } from './commands.data.js';
export function registerCommand(definition: CommandDefinition): void {
    commands.set(definition.name, definition);
    if (definition.aliases) { for (const alias of definition.aliases) commands.set(alias, definition); }
}
