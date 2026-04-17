/**
 * commands/alias.ts
 */
export class CommandAliases { private aliases = new Map<string, string>(); set(alias: string, command: string) { this.aliases.set(alias, command); } resolve(input: string): string { return this.aliases.get(input) || input; } list(): Record<string, string> { return Object.fromEntries(this.aliases); } remove(alias: string) { this.aliases.delete(alias); } }
