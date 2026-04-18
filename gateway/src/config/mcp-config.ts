/** CoreBlow — MCP Config */
export interface McpServerConfig { name: string; transport: "stdio" | "sse" | "http"; command?: string; args?: string[]; url?: string; env?: Record<string, string>; enabled?: boolean; }
export interface McpConfig { servers: McpServerConfig[]; }
export function getEnabledMcpServers(config: McpConfig): McpServerConfig[] { return config.servers.filter((s) => s.enabled !== false); }
