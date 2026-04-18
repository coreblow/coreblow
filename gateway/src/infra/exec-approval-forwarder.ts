/** CoreBlow — Exec Approval Forwarder */
export interface ApprovalForwardTarget { channelId: string; sessionId: string; }
export function resolveApprovalForwardTargets(sessionId: string, channelId?: string): ApprovalForwardTarget[] {
  const targets: ApprovalForwardTarget[] = [{ channelId: channelId ?? "default", sessionId }];
  return targets;
}
