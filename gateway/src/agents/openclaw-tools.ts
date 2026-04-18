/** CoreBlow tool definitions (compatibility). */
export const COREBLOW_TOOLS = ['bash', 'read', 'write', 'edit', 'search', 'glob', 'browser', 'mcp'] as const;
export type CoreBlowTool = typeof COREBLOW_TOOLS[number];
export function isCoreBlowTool(name: string): boolean { return COREBLOW_TOOLS.includes(name as CoreBlowTool); }
