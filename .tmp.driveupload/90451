/**
 * mcp/channel-tools.ts
 * MCP channel tool registration — registers tools available through MCP channels.
 */

export interface MCPChannelTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const channelTools = new Map<string, MCPChannelTool>();

export function registerChannelTool(tool: MCPChannelTool): void {
    channelTools.set(tool.name, tool);
}

export function getChannelTool(name: string): MCPChannelTool | undefined {
    return channelTools.get(name);
}

export function listChannelTools(): MCPChannelTool[] {
    return [...channelTools.values()];
}

export function removeChannelTool(name: string): boolean {
    return channelTools.delete(name);
}

export function clearChannelTools(): void {
    channelTools.clear();
}
