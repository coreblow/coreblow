/** CoreBlow — Build Program */
export function buildProgram(name: string, version: string): { name: string; version: string; commands: Map<string, unknown> } { return { name, version, commands: new Map() }; }
