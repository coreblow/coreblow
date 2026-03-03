/**
 * commands/autocomplete.ts
 */
export class AutoComplete { private commands: string[] = []; setCommands(cmds: string[]) { this.commands = cmds; } complete(partial: string): string[] { return this.commands.filter(c => c.startsWith(partial)).sort(); } completeArgs(command: string, partial: string): string[] { return []; } }
