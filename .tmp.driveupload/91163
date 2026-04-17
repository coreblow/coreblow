/** OpenClaw tool definitions (compatibility). */
export const OPENCLAW_TOOLS = ['bash', 'read', 'write', 'edit', 'search', 'glob', 'browser', 'mcp'] as const;
export type OpenClawTool = typeof OPENCLAW_TOOLS[number];
export function isOpenClawTool(name: string): boolean { return OPENCLAW_TOOLS.includes(name as OpenClawTool); }
