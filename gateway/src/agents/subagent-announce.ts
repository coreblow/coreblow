/**
 * agents/subagent-announce.ts
 * Subagent announcement — parent/child communication.
 */
export interface SubagentAnnouncement { agentId: string; parentId: string; sessionId: string; task: string; status: 'started' | 'completed' | 'failed' | 'cancelled'; result?: string; error?: string; timestamp: number; duration?: number; }
const announcements: SubagentAnnouncement[] = [];
export function announceSubagent(ann: Omit<SubagentAnnouncement, 'timestamp'>): SubagentAnnouncement {
    const full = { ...ann, timestamp: Date.now() };
    announcements.push(full);
    if (announcements.length > 200) announcements.splice(0, announcements.length - 200);
    return full;
}
export function getAnnouncements(parentId?: string): SubagentAnnouncement[] { return parentId ? announcements.filter((a) => a.parentId === parentId) : [...announcements]; }
export function clearAnnouncements(): void { announcements.length = 0; }
export function formatAnnouncement(ann: SubagentAnnouncement): string {
    const icon = ann.status === 'completed' ? '✅' : ann.status === 'failed' ? '❌' : ann.status === 'started' ? '🔄' : '⏹';
    return `${icon} [${ann.agentId}] ${ann.task} — ${ann.status}${ann.duration ? ` (${ann.duration}ms)` : ''}`;
}
