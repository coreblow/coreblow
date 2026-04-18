/** CoreBlow — Session Group */
export interface SessionGroup { groupId: string; sessionIds: string[]; createdAt: number; }
export function createSessionGroup(groupId: string): SessionGroup { return { groupId, sessionIds: [], createdAt: Date.now() }; }
