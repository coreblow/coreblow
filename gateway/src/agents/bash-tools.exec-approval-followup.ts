/** agents/bash-tools.exec-approval-followup.ts — Follow up on exec approvals. */
export function formatApprovalFollowup(command: string, status: string): string {
    return status === 'approved' ? `✅ Command approved: ${command}` : `❌ Command denied: ${command}`;
}
export function shouldAutoApprove(command: string, safePatterns: string[]): boolean {
    return safePatterns.some((p) => command.startsWith(p));
}
export const DEFAULT_AUTO_APPROVE_PATTERNS = ['echo ', 'cat ', 'ls ', 'pwd', 'whoami', 'date', 'which ', 'type '];
