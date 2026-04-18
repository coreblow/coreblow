/** CoreBlow — Channel Summary */
export interface ChannelSummary { channelId: string; name: string; type: string; connected: boolean; lastActivity?: number; messageCount: number; errorCount: number; }
export function formatChannelSummary(summary: ChannelSummary): string { const status = summary.connected ? '🟢' : '🔴'; return `${status} ${summary.name} (${summary.type}) — ${summary.messageCount} msgs, ${summary.errorCount} errors`; }
export function formatChannelSummaries(summaries: ChannelSummary[]): string { if (summaries.length === 0) return 'No channels configured.'; return summaries.map(formatChannelSummary).join('\n'); }
