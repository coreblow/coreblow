export interface ApprovalRequest { id: string; command: string; reason: string; }
export function createApprovalRequest(command: string, reason: string): ApprovalRequest { return { id: `apr_${Date.now()}`, command, reason }; }
export function isApproved(requestId: string): boolean { return false; }
