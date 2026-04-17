/** agents/bash-tools.exec-types.ts — Exec tool type definitions. */
export type ExecApprovalStatus = 'pending' | 'approved' | 'denied' | 'auto_approved';
export interface ExecRequest { command: string; cwd?: string; timeout?: number; requiresApproval: boolean; riskLevel: 'safe' | 'moderate' | 'dangerous'; }
export interface ExecApproval { requestId: string; status: ExecApprovalStatus; approvedBy?: string; timestamp: number; }
export function createExecRequest(command: string, opts?: Partial<ExecRequest>): ExecRequest {
    return { command, cwd: opts?.cwd, timeout: opts?.timeout ?? 30_000, requiresApproval: opts?.requiresApproval ?? false, riskLevel: opts?.riskLevel ?? 'safe' };
}
