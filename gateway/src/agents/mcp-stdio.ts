/** MCP stdio transport. */
export interface StdioTransportConfig { command: string; args?: string[]; env?: Record<string, string>; }
export function buildStdioArgs(config: StdioTransportConfig): string[] { return [config.command, ...(config.args ?? [])]; }
