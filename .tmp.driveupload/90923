/**
 * agents/subagent-depth.ts
 * Subagent nesting depth tracking to prevent infinite recursion.
 */
export const MAX_SUBAGENT_DEPTH = 5;
export interface DepthContext { current: number; max: number; path: string[]; }
export function createDepthContext(max = MAX_SUBAGENT_DEPTH): DepthContext { return { current: 0, max, path: [] }; }
export function canSpawnSubagent(ctx: DepthContext): boolean { return ctx.current < ctx.max; }
export function incrementDepth(ctx: DepthContext, agentId: string): DepthContext { return { current: ctx.current + 1, max: ctx.max, path: [...ctx.path, agentId] }; }
export function formatDepthPath(ctx: DepthContext): string { return ctx.path.length === 0 ? '(root)' : ctx.path.join(' → '); }
export function isAtMaxDepth(ctx: DepthContext): boolean { return ctx.current >= ctx.max; }
