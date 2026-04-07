/**
 * agents/auth-profiles/order.ts
 * Auth profile ordering — normalize provider IDs for consistent lookup.
 */

export function normalizeProviderId(raw: string | undefined): string {
    if (!raw) return 'default';
    return raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function compareProfilePriority(
    a: { priority?: number },
    b: { priority?: number },
): number {
    return (b.priority ?? 0) - (a.priority ?? 0);
}
