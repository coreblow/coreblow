/** CoreBlow — Channels Status Issues */
export interface ChannelStatusIssue { channelId: string; severity: 'warning' | 'error' | 'critical'; message: string; timestamp: number; }
export function categorizeIssues(issues: ChannelStatusIssue[]): { warnings: ChannelStatusIssue[]; errors: ChannelStatusIssue[]; critical: ChannelStatusIssue[] } {
  return { warnings: issues.filter((i) => i.severity === 'warning'), errors: issues.filter((i) => i.severity === 'error'), critical: issues.filter((i) => i.severity === 'critical') };
}
