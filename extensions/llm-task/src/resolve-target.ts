/**
 * Resolve message target for LlmTask
 */
export interface ResolveResult {
  targetId: string;
  targetType: 'user' | 'channel' | 'group' | 'thread';
  displayName: string;
}

export async function resolveTarget(identifier: string): Promise<ResolveResult> {
  if (identifier.startsWith('#')) {
    return { targetId: identifier.slice(1), targetType: 'channel', displayName: identifier };
  }
  if (identifier.startsWith('@')) {
    return { targetId: identifier.slice(1), targetType: 'user', displayName: identifier };
  }
  return { targetId: identifier, targetType: 'channel', displayName: identifier };
}

export function normalizeChannelId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

export function isValidTarget(id: string): boolean {
  return id.length > 0 && id.length <= 128;
}
