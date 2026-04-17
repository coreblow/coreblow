/** Embedded MCP bridge. */
export interface McpBridgeConfig { serverName: string; transport: 'stdio' | 'sse'; }
export function createMcpBridge(name: string, transport: 'stdio' | 'sse' = 'stdio'): McpBridgeConfig { return { serverName: name, transport }; }
