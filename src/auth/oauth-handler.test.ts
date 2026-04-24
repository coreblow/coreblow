import { describe, it, expect, beforeEach } from 'vitest';
import { OAuthHandler } from './oauth-handler.js';

const TEST_PROVIDER = {
    name: 'github',
    clientId: 'client-123',
    clientSecret: 'secret-456',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['user', 'repo'],
    redirectUri: 'http://localhost:3000/callback',
};

describe('OAuthHandler', () => {
    let oauth: OAuthHandler;

    beforeEach(() => {
        oauth = new OAuthHandler();
    });

    describe('registerProvider', () => {
        it('registers a provider', () => {
            oauth.registerProvider(TEST_PROVIDER);
            expect(oauth.listProviders()).toContain('github');
        });

        it('overwrites existing provider', () => {
            oauth.registerProvider(TEST_PROVIDER);
            oauth.registerProvider({ ...TEST_PROVIDER, clientId: 'new-id' });
            expect(oauth.listProviders()).toHaveLength(1);
        });
    });

    describe('getAuthUrl', () => {
        it('generates auth URL with correct params', () => {
            oauth.registerProvider(TEST_PROVIDER);
            const result = oauth.getAuthUrl('github');
            expect(result).not.toBeNull();
            expect(result!.url).toContain('github.com/login/oauth/authorize');
            expect(result!.url).toContain('client_id=client-123');
            expect(result!.url).toContain('response_type=code');
            expect(result!.url).toContain('scope=user+repo');
            expect(result!.state).toMatch(/^state-/);
        });

        it('returns null for unknown provider', () => {
            expect(oauth.getAuthUrl('unknown')).toBeNull();
        });

        it('generates unique states', () => {
            oauth.registerProvider(TEST_PROVIDER);
            const r1 = oauth.getAuthUrl('github')!;
            const r2 = oauth.getAuthUrl('github')!;
            expect(r1.state).not.toBe(r2.state);
        });
    });

    describe('exchangeCode', () => {
        it('exchanges code for token', async () => {
            oauth.registerProvider(TEST_PROVIDER);
            const { state } = oauth.getAuthUrl('github')!;
            const token = await oauth.exchangeCode('auth-code-123', state, 'user1');
            expect(token).not.toBeNull();
            expect(token!.accessToken).toContain('auth-code-123');
            expect(token!.refreshToken).toBeDefined();
            expect(token!.provider).toBe('github');
            expect(token!.userId).toBe('user1');
            expect(token!.scopes).toEqual(['user', 'repo']);
        });

        it('returns null for invalid state', async () => {
            const token = await oauth.exchangeCode('code', 'bad-state', 'user1');
            expect(token).toBeNull();
        });

        it('invalidates state after use', async () => {
            oauth.registerProvider(TEST_PROVIDER);
            const { state } = oauth.getAuthUrl('github')!;
            await oauth.exchangeCode('code', state, 'user1');
            const token2 = await oauth.exchangeCode('code', state, 'user1');
            expect(token2).toBeNull();
        });
    });

    describe('getToken', () => {
        it('returns stored token', async () => {
            oauth.registerProvider(TEST_PROVIDER);
            const { state } = oauth.getAuthUrl('github')!;
            await oauth.exchangeCode('code', state, 'user1');
            const token = oauth.getToken('user1');
            expect(token).not.toBeNull();
            expect(token!.provider).toBe('github');
        });

        it('returns null for unknown user', () => {
            expect(oauth.getToken('unknown')).toBeNull();
        });
    });

    describe('isExpired', () => {
        it('returns false for fresh token', async () => {
            oauth.registerProvider(TEST_PROVIDER);
            const { state } = oauth.getAuthUrl('github')!;
            await oauth.exchangeCode('code', state, 'user1');
            expect(oauth.isExpired('user1')).toBe(false);
        });

        it('returns true for unknown user', () => {
            expect(oauth.isExpired('unknown')).toBe(true);
        });
    });

    describe('listProviders + countTokens', () => {
        it('lists registered providers', () => {
            expect(oauth.listProviders()).toHaveLength(0);
            oauth.registerProvider(TEST_PROVIDER);
            oauth.registerProvider({ ...TEST_PROVIDER, name: 'google' });
            expect(oauth.listProviders()).toEqual(['github', 'google']);
        });

        it('counts tokens', async () => {
            oauth.registerProvider(TEST_PROVIDER);
            expect(oauth.countTokens()).toBe(0);
            const { state } = oauth.getAuthUrl('github')!;
            await oauth.exchangeCode('code', state, 'user1');
            expect(oauth.countTokens()).toBe(1);
        });
    });
});
