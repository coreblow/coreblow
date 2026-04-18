/** CoreBlow — Command Registry */
const registry = new Map<string, { name: string; description: string; handler: Function }>();
export function registerCommand(name: string, description: string, handler: Function): void { registry.set(name, { name, description, handler }); }
export function getCommand(name: string): { handler: Function } | undefined { return registry.get(name); }
export function getAllCommands(): Array<{ name: string; description: string }> { return [...registry.values()]; }
