/** CoreBlow — Exec Approval Reply */
export interface ApprovalReply { approved: boolean; reason?: string; timestamp: number; responderId?: string; }
export function createApprovalReply(approved: boolean, reason?: string): ApprovalReply { return { approved, reason, timestamp: Date.now() }; }
