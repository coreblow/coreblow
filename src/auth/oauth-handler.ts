/**
 * CoreBlow — OAuth Handler
 *
 * Handles OAuth 2.0 authorization code flow,
 * token exchange, and provider management.
 */

/** OAuth provider */
export interface OAuthProvider {
    name: string;
    clientId: string;
    clientSecret: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    redirectUri: string;
}

/** OAuth token */
export interface OAuthToken {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    provider: string;
    userId: string;
    scopes: string[];
}

/**
 * CoreBlow OAuth Handler
 */
export class OAuthHandler {
    private providers = new Map<string, OAuthProvider>();
    private tokens = new Map<string, OAuthToken>();
    private states = new Map<string, { provider: string; timestamp: number }>();
    private idCounter = 0;

    /**
     * Register a provider.
     */
    registerProvider(provider: OAuthProvider): void {
        this.providers.set(provider.name, provider);
    }

    /**
     * Generate authorization URL.
     */
    getAuthUrl(providerName: string): { url: string; state: string } | null {
        const provider = this.providers.get(providerName);
        if (!provider) return null;
        const state = `state-${++this.idCounter}-${Date.now()}`;
        this.states.set(state, { provider: providerName, timestamp: Date.now() });
        const params = [
            `client_id=${provider.clientId}`,
            `redirect_uri=${encodeURIComponent(provider.redirectUri)}`,
            `scope=${provider.scopes.join('+')}`,
            `state=${state}`,
            'response_type=code',
        ];
        return { url: `${provider.authUrl}?${params.join('&')}`, state };
    }

    /**
     * Exchange code for token (simulated).
     */
    async exchangeCode(code: string, state: string, userId: string): Promise<OAuthToken | null> {
        const stateData = this.states.get(state);
        if (!stateData) return null;
        this.states.delete(state);

        const provider = this.providers.get(stateData.provider);
        if (!provider) return null;

        const token: OAuthToken = {
            accessToken: `access_${code}_${Date.now()}`,
            refreshToken: `refresh_${code}_${Date.now()}`,
            expiresAt: Date.now() + 3600_000,
            provider: stateData.provider,
            userId, scopes: provider.scopes,
        };
        this.tokens.set(userId, token);
        return token;
    }

    /**
     * Get token for user.
     */
    getToken(userId: string): OAuthToken | null { return this.tokens.get(userId) ?? null; }

    /**
     * Check if token is expired.
     */
    isExpired(userId: string): boolean {
        const token = this.tokens.get(userId);
        return !token || Date.now() > token.expiresAt;
    }

    /**
     * List providers.
     */
    listProviders(): string[] { return Array.from(this.providers.keys()); }

    /** Count tokens */
    countTokens(): number { return this.tokens.size; }
}
