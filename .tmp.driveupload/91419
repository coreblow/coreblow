/**
 * agents/auth-profiles/identity.ts
 * Identity resolution for auth profiles.
 */

export interface AuthIdentity {
    userId: string;
    displayName?: string;
    provider?: string;
    channel?: string;
    roles?: string[];
}

export function resolveIdentity(params: {
    userId?: string;
    channel?: string;
    provider?: string;
}): AuthIdentity {
    return {
        userId: params.userId ?? 'anonymous',
        channel: params.channel,
        provider: params.provider,
    };
}

export function isAuthenticated(identity: AuthIdentity): boolean {
    return identity.userId !== 'anonymous';
}
