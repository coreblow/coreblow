/** agents/bash-tools.exec-approval-request.ts — Exec approval request. */
import type { ExecApproval, ExecRequest } from './bash-tools.exec-types.js';
const pendingApprovals = new Map<string, { request: ExecRequest; resolve: (a: ExecApproval) => void }>();
let reqCounter = 0;
export function requestApproval(request: ExecRequest): Promise<ExecApproval> {
    const id = `req_${++reqCounter}`;
    return new Promise((resolve) => { pendingApprovals.set(id, { request, resolve }); });
}
export function approveRequest(requestId: string, approvedBy?: string): boolean {
    const pending = pendingApprovals.get(requestId);
    if (!pending) return false;
    pending.resolve({ requestId, status: 'approved', approvedBy, timestamp: Date.now() });
    pendingApprovals.delete(requestId);
    return true;
}
export function denyRequest(requestId: string): boolean {
    const pending = pendingApprovals.get(requestId);
    if (!pending) return false;
    pending.resolve({ requestId, status: 'denied', timestamp: Date.now() });
    pendingApprovals.delete(requestId);
    return true;
}
export function getPendingCount(): number { return pendingApprovals.size; }
export function clearPendingApprovals(): void { pendingApprovals.clear(); }
