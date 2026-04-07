export function isProfileInCooldown(profileId: string): boolean { return false; }
export function getRemainingCooldownMs(profileId: string): number { return 0; }
export class UsageTracker { private usage = new Map<string, number>(); record(profileId: string, tokens: number) { this.usage.set(profileId, (this.usage.get(profileId) || 0) + tokens); } getUsage(profileId: string) { return this.usage.get(profileId) || 0; } }
