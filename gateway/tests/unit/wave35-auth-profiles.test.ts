/**
 * Wave 35: Auth Profiles
 *
 * Tests credential state evaluation, repair mechanisms, session overrides,
 * auth doctor diagnostics, state observation, and paths.
 * TARGET: ~35 tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    evaluateStoredCredentialEligibility,
    resolveTokenExpiryState
} from '../../src/agents/auth-profiles/credential-state.js';
import {
    repairAuthProfileIds,
    detectAuthProfileIssues
} from '../../src/agents/auth-profiles/repair.js';
import {
    setSessionAuthOverride,
    getSessionAuthOverride,
    clearSessionAuthOverride,
    resolveEffectiveProfile,
    pruneExpiredOverrides,
    resetSessionOverridesForTests
} from '../../src/agents/auth-profiles/session-override.js';
import { diagnoseAuthProfiles } from '../../src/agents/auth-profiles/doctor.js';
import { 
    onAuthStateChange, 
    emitAuthStateEvent, 
    clearAuthStateListeners, 
    authStateListenerCount 
} from '../../src/agents/auth-profiles/state-observation.js';
import { formatCredentialType, maskCredentialValue } from '../../src/agents/auth-profiles/display.js';
import { resolveAuthDir, resolveAuthStorePath } from '../../src/agents/auth-profiles/paths.js';
import { normalizeProviderId } from '../../src/agents/auth-profiles/order.js';
import type { AuthProfileStore, AuthProfileCredential } from '../../src/agents/auth-profiles/types.js';

// ─── Credential State ─────────────────────────────────────────────────────

describe('Credential State', () => {
    it('evaluates api_key credentials as eligible if key exists', () => {
        const ok = evaluateStoredCredentialEligibility({
            credential: { type: 'api_key', provider: 'openai', key: 'sk-123' }
        });
        expect(ok.eligible).toBe(true);
    });

    it('evaluates api_key credentials as ineligible if key empty', () => {
        const missing = evaluateStoredCredentialEligibility({
            credential: { type: 'api_key', provider: 'openai', key: '' }
        });
        expect(missing.eligible).toBe(false);
        expect(missing.reasonCode).toBe('missing_credential');
    });



    it('evaluates oauth credentials as eligible if access token exists', () => {
        const ok = evaluateStoredCredentialEligibility({
            credential: { type: 'oauth', provider: 'google', access: 'access_tok', refresh: '', expires: 0 }
        });
        expect(ok.eligible).toBe(true);
    });

    it('evaluates oauth credentials as ineligible if access token is empty', () => {
        const missing = evaluateStoredCredentialEligibility({
            credential: { type: 'oauth', provider: 'google', access: '', refresh: '', expires: 0 }
        });
        expect(missing.eligible).toBe(false);
    });

    it('resolveTokenExpiryState handles missing or 0', () => {
        expect(resolveTokenExpiryState(undefined)).toBe('missing');
        expect(resolveTokenExpiryState(0)).toBe('invalid_expires');
    });

    it('resolveTokenExpiryState handles invalid formatting', () => {
        expect(resolveTokenExpiryState('not-a-number')).toBe('invalid_expires');
    });

    it('resolveTokenExpiryState identifies expired tokens', () => {
        const now = 1000;
        expect(resolveTokenExpiryState(500, now)).toBe('expired');
    });

    it('resolveTokenExpiryState identifies valid tokens', () => {
        const now = 1000;
        expect(resolveTokenExpiryState(1500, now)).toBe('valid');
    });
});

// ─── Auth Profile Repair ──────────────────────────────────────────────────

describe('Auth Profile Repair', () => {
    it('repairAuthProfileIds adds provider prefix if missing', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: {
                'default': { type: 'api_key', provider: 'openai', key: 'k1' }
            }
        };
        const result = repairAuthProfileIds(store);
        expect(result.migrated).toBe(true);
        expect(store.profiles['openai:default']).toBeDefined();
        expect(store.profiles['default']).toBeUndefined();
    });

    it('repairAuthProfileIds normalizes provider aliases', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: {
                'gpt:admin': { type: 'api_key', provider: 'openai', key: 'k2' }
            }
        };
        const result = repairAuthProfileIds(store);
        expect(result.migrated).toBe(true);
        expect(store.profiles['openai:admin']).toBeDefined();
    });

    it('repairAuthProfileIds removes dangling references in order and usageStats', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: { 'openai:exists': { type: 'api_key', provider: 'openai', key: 'k' } },
            order: { 'openai': ['openai:exists', 'openai:dangling'] },
            usageStats: { 'openai:exists': {}, 'openai:dangling': {} },
            lastGood: { 'openai': 'openai:dangling' }
        };
        const result = repairAuthProfileIds(store);
        expect(result.migrated).toBe(true);
        expect(store.order?.['openai']).toEqual(['openai:exists']);
        expect(store.usageStats?.['openai:dangling']).toBeUndefined();
        expect(store.lastGood?.['openai']).toBeUndefined();
    });

    it('detectAuthProfileIssues finds bad ID format', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: { 'bad-id': { type: 'api_key', provider: 'openai', key: 'k' } }
        };
        const issues = detectAuthProfileIssues(store);
        expect(issues.some(i => i.includes('missing provider prefix'))).toBe(true);
    });

    it('detectAuthProfileIssues finds missing keys', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: { 'openai:no-key': { type: 'api_key', provider: 'openai', key: '' } }
        };
        const issues = detectAuthProfileIssues(store);
        expect(issues.some(i => i.includes('has no key'))).toBe(true);
    });


});

// ─── Session Override ─────────────────────────────────────────────────────

describe('Session Overrides', () => {
    beforeEach(() => {
        resetSessionOverridesForTests();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const mockCred: AuthProfileCredential = { type: 'api_key', provider: 'openai', key: 'k' };

    it('setSessionAuthOverride saves override state', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'openai:ovr', credential: mockCred });
        const override = getSessionAuthOverride('s1', 'openai');
        expect(override?.profileId).toBe('openai:ovr');
        expect(override?.credential).toBe(mockCred);
    });

    it('getSessionAuthOverride returns null if none exists', () => {
        const override = getSessionAuthOverride('s1', 'openai');
        expect(override).toBeNull();
    });

    it('override expires after durationMs', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'openai:ovr', durationMs: 1000 });
        expect(getSessionAuthOverride('s1', 'openai')).not.toBeNull();
        vi.advanceTimersByTime(1100);
        expect(getSessionAuthOverride('s1', 'openai')).toBeNull(); // expired
    });

    it('clearSessionAuthOverride removes override', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'openai:ovr' });
        clearSessionAuthOverride('s1');
        expect(getSessionAuthOverride('s1', 'openai')).toBeNull();
    });

    it('clearSessionAuthOverride does not affect other sessions', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'openai:ovr' });
        setSessionAuthOverride({ sessionKey: 's2', provider: 'openai', profileId: 'openai:ovr' });
        clearSessionAuthOverride('s1');
        expect(getSessionAuthOverride('s2', 'openai')).not.toBeNull();
    });

    it('pruneExpiredOverrides removes expired from map', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'ovr', durationMs: 100 });
        setSessionAuthOverride({ sessionKey: 's2', provider: 'openai', profileId: 'ovr', durationMs: 5000 });
        vi.advanceTimersByTime(1000);
        const pruned = pruneExpiredOverrides();
        expect(pruned).toBe(1);
        expect(getSessionAuthOverride('s1', 'openai')).toBeNull();
    });

    it('resolveEffectiveProfile returns override if present', () => {
        setSessionAuthOverride({ sessionKey: 's1', provider: 'openai', profileId: 'openai:ovr', credential: mockCred });
        const store: AuthProfileStore = { version: 1, profiles: {} };
        const fallback = vi.fn().mockReturnValue({ profileId: 'openai:default', credential: mockCred });
        
        const resolved = resolveEffectiveProfile({ sessionKey: 's1', provider: 'openai', store, fallback });
        expect(resolved?.profileId).toBe('openai:ovr');
        expect(resolved?.overridden).toBe(true);
        expect(fallback).not.toHaveBeenCalled();
    });

    it('resolveEffectiveProfile returns fallback if override missing/expired', () => {
        const store: AuthProfileStore = { version: 1, profiles: {} };
        const fallback = vi.fn().mockReturnValue({ profileId: 'openai:default', credential: mockCred });
        const resolved = resolveEffectiveProfile({ sessionKey: 's1', provider: 'openai', store, fallback });
        expect(resolved?.overridden).toBe(false);
        expect(fallback).toHaveBeenCalled();
    });
});

// ─── Auth Doctor ──────────────────────────────────────────────────────────

describe('Auth Doctor', () => {
    it('diagnoseAuthProfiles reports total and eligible profiles', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: {
                'openai:ok': { type: 'api_key', provider: 'openai', key: 'sk' },
                'anthropic:bad': { type: 'api_key', provider: 'anthropic', key: '' }
            }
        };
        const report = diagnoseAuthProfiles(store);
        expect(report.totalProfiles).toBe(2);
        expect(report.eligibleProfiles).toBe(1);
    });

    it('diagnoseAuthProfiles labels missing credentials correctly', () => {
        const store: AuthProfileStore = {
            version: 1,
            profiles: {
                'anthropic:bad': { type: 'api_key', provider: 'anthropic', key: '' }
            }
        };
        const report = diagnoseAuthProfiles(store);
        const badEntry = report.entries.find(e => e.profileId === 'anthropic:bad');
        expect(badEntry?.eligible).toBe(false);
        expect(badEntry?.reasonCode).toBe('missing_credential');
    });

    it('diagnoseAuthProfiles handles empty store smoothly', () => {
        const store: AuthProfileStore = { version: 1, profiles: {} };
        const report = diagnoseAuthProfiles(store);
        expect(report.totalProfiles).toBe(0);
        expect(report.eligibleProfiles).toBe(0);
    });
});

// ─── State Observation ────────────────────────────────────────────────────

describe('State Observation', () => {
    beforeEach(() => { clearAuthStateListeners(); });

    it('adds listener and returns unsubscribe function', () => {
        const fn = vi.fn();
        const unsub = onAuthStateChange(fn);
        expect(authStateListenerCount()).toBe(1);
        unsub();
        expect(authStateListenerCount()).toBe(0);
    });

    it('emits events to listeners', () => {
        const fn = vi.fn();
        onAuthStateChange(fn);
        emitAuthStateEvent({ type: 'profile_updated', profileId: 'test', provider: 'p' });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0].type).toBe('profile_updated');
    });

    it('clearAuthStateListeners removes all', () => {
        onAuthStateChange(vi.fn());
        onAuthStateChange(vi.fn());
        expect(authStateListenerCount()).toBe(2);
        clearAuthStateListeners();
        expect(authStateListenerCount()).toBe(0);
    });

    it('emits profile_removed event safely', () => {
        const fn = vi.fn();
        onAuthStateChange(fn);
        emitAuthStateEvent({ type: 'profile_removed', profileId: 'test', provider: 'p' });
        expect(fn).toHaveBeenCalledWith(expect.objectContaining({ type: 'profile_removed' }));
    });
});

// ─── Display & Format ─────────────────────────────────────────────────────

describe('Display & Format', () => {
    it('formatCredentialType maps types to user-friendly strings', () => {
        expect(formatCredentialType({ type: 'api_key', provider: 'a', key: 'b' })).toBe('API Key');
        expect(formatCredentialType({ type: 'oauth', provider: 'a', access: 'b' } as any)).toBe('OAuth');
    });

    it('maskCredentialValue hides sensitive data', () => {
        const masked = maskCredentialValue({ type: 'api_key', provider: 'openai', key: 'sk-1234567890abcdef' });
        expect(masked).toBe('sk-1...cdef');
        
        const shortMasked = maskCredentialValue({ type: 'api_key', provider: 'openai', key: 'short' });
        expect(shortMasked).toBe('****');
    });
});

// ─── Paths & Order Utilities ──────────────────────────────────────────────

describe('Paths & Order', () => {
    it('resolveAuthDir finds directory relative to agent', () => {
        const dir = resolveAuthDir('/tmp/agent');
        expect(dir).toContain('/tmp/agent');
        expect(dir).toContain('.coreblow');
    });

    it('resolveAuthStorePath points to profiles.json', () => {
        const p = resolveAuthStorePath('/tmp/agent');
        expect(p).toContain('profiles.json');
    });

    it('normalizeProviderId cleans provider strings', () => {
        expect(normalizeProviderId('OpenAI!')).toBe('openai');
        expect(normalizeProviderId('  google-vertex ')).toBe('google-vertex');
    });
});
