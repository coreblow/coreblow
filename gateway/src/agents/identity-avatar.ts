/** agents/identity-avatar.ts — Avatar utilities. */
export function getDefaultAvatar(): string { return '🤖'; }
export function resolveAvatar(avatar?: string): string { return avatar ?? getDefaultAvatar(); }
