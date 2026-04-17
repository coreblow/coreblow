/** PI before-tool-call hooks. */
export type BeforeToolCallHook = (toolName: string, args: Record<string, unknown>) => { proceed: boolean; reason?: string };
export function createAutoApproveHook(safeTools: string[]): BeforeToolCallHook {
    return (toolName) => ({ proceed: safeTools.includes(toolName) });
}
