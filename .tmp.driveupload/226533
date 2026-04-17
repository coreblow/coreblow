/**
 * CoreBlow Phase 41 — Auth & Access Control Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { JWTManager } from '../../src/auth/jwt-manager.js';
import { ApiKeyManager } from '../../src/auth/api-key-manager.js';
import { OAuthHandler } from '../../src/auth/oauth-handler.js';
import { PermissionResolver } from '../../src/auth/permission-resolver.js';
import { SessionAuth } from '../../src/auth/session-auth.js';

// ================================================================
describe('JWTManager', () => {
    let jwt: JWTManager;
    beforeEach(() => { jwt = new JWTManager({ issuer: 'coreblow', expiresInMs: 60_000 }); });

    it('should issue tokens', () => {
        const { token, payload } = jwt.issue('user-1', ['admin']);
        expect(token).toBeTruthy();
        expect(payload.sub).toBe('user-1');
    });

    it('should verify valid tokens', () => {
        const { token } = jwt.issue('user-1');
        const result = jwt.verify(token);
        expect(result.valid).toBe(true);
    });

    it('should reject revoked tokens', () => {
        const { token } = jwt.issue('user-1');
        jwt.revoke(token);
        expect(jwt.verify(token).valid).toBe(false);
    });

    it('should refresh tokens', () => {
        const { token } = jwt.issue('user-1', ['admin']);
        const refreshed = jwt.refresh(token);
        expect(refreshed).toBeTruthy();
        expect(jwt.verify(token).valid).toBe(false); // old one revoked
    });

    it('should include roles and claims', () => {
        const { payload } = jwt.issue('user-1', ['admin'], { tenant: 'acme' });
        expect(payload.roles).toContain('admin');
        expect(payload.claims?.tenant).toBe('acme');
    });

    it('should track stats', () => {
        jwt.issue('u1');
        expect(jwt.getStats().issued).toBe(1);
    });
});

// ================================================================
describe('ApiKeyManager', () => {
    let akm: ApiKeyManager;
    beforeEach(() => { akm = new ApiKeyManager(); });

    it('should create keys', () => {
        const key = akm.create('My App', 'user-1', ['read']);
        expect(key.key).toMatch(/^cb_/);
    });

    it('should validate keys', () => {
        const key = akm.create('App', 'user-1');
        const result = akm.validate(key.key);
        expect(result.valid).toBe(true);
    });

    it('should check scopes', () => {
        const key = akm.create('App', 'user-1', ['read']);
        expect(akm.validate(key.key, 'write').valid).toBe(false);
    });

    it('should enforce rate limits', () => {
        const key = akm.create('App', 'user-1', ['*'], 2);
        akm.validate(key.key);
        akm.validate(key.key);
        expect(akm.validate(key.key).valid).toBe(false);
    });

    it('should rotate keys', () => {
        const key = akm.create('App', 'user-1');
        const oldKey = key.key;
        akm.rotate(key.id);
        expect(akm.validate(oldKey).valid).toBe(false);
    });

    it('should deactivate', () => {
        const key = akm.create('App', 'user-1');
        akm.deactivate(key.id);
        expect(akm.validate(key.key).valid).toBe(false);
    });
});

// ================================================================
describe('OAuthHandler', () => {
    let oauth: OAuthHandler;
    beforeEach(() => {
        oauth = new OAuthHandler();
        oauth.registerProvider({
            name: 'github', clientId: 'abc', clientSecret: 'secret',
            authUrl: 'https://github.com/login/oauth/authorize',
            tokenUrl: 'https://github.com/login/oauth/access_token',
            scopes: ['user', 'repo'], redirectUri: 'http://localhost/callback',
        });
    });

    it('should generate auth URL', () => {
        const result = oauth.getAuthUrl('github');
        expect(result?.url).toContain('github.com');
        expect(result?.state).toBeTruthy();
    });

    it('should exchange code for token', async () => {
        const { state } = oauth.getAuthUrl('github')!;
        const token = await oauth.exchangeCode('code123', state, 'user-1');
        expect(token?.accessToken).toBeTruthy();
    });

    it('should get token for user', async () => {
        const { state } = oauth.getAuthUrl('github')!;
        await oauth.exchangeCode('code', state, 'user-1');
        expect(oauth.getToken('user-1')).toBeTruthy();
    });

    it('should list providers', () => {
        expect(oauth.listProviders()).toContain('github');
    });
});

// ================================================================
describe('PermissionResolver', () => {
    let pr: PermissionResolver;
    beforeEach(() => {
        pr = new PermissionResolver();
        pr.defineRole('viewer', [{ resource: 'posts', action: 'read' }]);
        pr.defineRole('editor', [{ resource: 'posts', action: 'write' }], ['viewer']);
        pr.defineRole('admin', [{ resource: '*', action: '*' }]);
    });

    it('should resolve direct permissions', () => {
        pr.assignRoles('u1', ['viewer']);
        expect(pr.can('u1', 'posts', 'read')).toBe(true);
        expect(pr.can('u1', 'posts', 'write')).toBe(false);
    });

    it('should resolve inherited permissions', () => {
        pr.assignRoles('u1', ['editor']);
        expect(pr.can('u1', 'posts', 'read')).toBe(true); // inherited from viewer
        expect(pr.can('u1', 'posts', 'write')).toBe(true);
    });

    it('should handle wildcard admin', () => {
        pr.assignRoles('u1', ['admin']);
        expect(pr.can('u1', 'anything', 'any-action')).toBe(true);
    });

    it('should apply user overrides', () => {
        pr.assignRoles('u1', ['viewer']);
        pr.addOverride('u1', [{ resource: 'settings', action: 'write' }]);
        expect(pr.can('u1', 'settings', 'write')).toBe(true);
    });

    it('should list roles', () => {
        expect(pr.listRoles()).toHaveLength(3);
    });
});

// ================================================================
describe('SessionAuth', () => {
    let auth: SessionAuth;
    beforeEach(() => { auth = new SessionAuth(60_000, 3); });

    it('should create sessions', () => {
        const session = auth.create('user-1', { theme: 'dark' });
        expect(session.userId).toBe('user-1');
    });

    it('should validate sessions', () => {
        const session = auth.create('user-1');
        expect(auth.validate(session.id).valid).toBe(true);
    });

    it('should renew sessions', () => {
        const session = auth.create('user-1');
        auth.renew(session.id);
        expect(auth.validate(session.id).valid).toBe(true);
    });

    it('should destroy sessions', () => {
        const session = auth.create('user-1');
        auth.destroy(session.id);
        expect(auth.validate(session.id).valid).toBe(false);
    });

    it('should destroy all for user', () => {
        auth.create('user-1');
        auth.create('user-1');
        const count = auth.destroyAll('user-1');
        expect(count).toBe(2);
    });

    it('should enforce max per user', () => {
        auth.create('user-1');
        auth.create('user-1');
        auth.create('user-1');
        auth.create('user-1'); // should evict 1
        expect(auth.count()).toBe(3);
    });
});
