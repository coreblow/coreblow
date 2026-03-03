/**
 * Discord Cooldown — Per-user command cooldown tracking.
 */
export class CooldownManager {
    private cooldowns = new Map<string, Map<string, number>>();

    set(userId: string, command: string, durationMs: number): void {
        if (!this.cooldowns.has(userId)) this.cooldowns.set(userId, new Map());
        this.cooldowns.get(userId)!.set(command, Date.now() + durationMs);
    }

    check(userId: string, command: string): { onCooldown: boolean; remainingMs: number } {
        const userCooldowns = this.cooldowns.get(userId);
        if (!userCooldowns) return { onCooldown: false, remainingMs: 0 };
        const expiresAt = userCooldowns.get(command);
        if (!expiresAt || Date.now() >= expiresAt) { userCooldowns.delete(command); return { onCooldown: false, remainingMs: 0 }; }
        return { onCooldown: true, remainingMs: expiresAt - Date.now() };
    }

    clear(userId: string): void { this.cooldowns.delete(userId); }
    clearAll(): void { this.cooldowns.clear(); }
}
