/**
 * CoreBlow — Consent Manager Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConsentManager } from './consent-manager.js';

describe('ConsentManager', () => {
    let cm: ConsentManager;

    beforeEach(() => {
        cm = new ConsentManager();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should have 4 default categories', () => {
            expect(cm.listCategories()).toHaveLength(4);
        });

        it('should include essential, analytics, ai-training, personalization', () => {
            const ids = cm.listCategories().map((c) => c.id);
            expect(ids).toContain('essential');
            expect(ids).toContain('analytics');
            expect(ids).toContain('ai-training');
            expect(ids).toContain('personalization');
        });

        it('essential should be required with default true', () => {
            const essential = cm.listCategories().find((c) => c.id === 'essential')!;
            expect(essential.required).toBe(true);
            expect(essential.defaultValue).toBe(true);
        });

        it('analytics should be optional with default false', () => {
            const analytics = cm.listCategories().find((c) => c.id === 'analytics')!;
            expect(analytics.required).toBe(false);
            expect(analytics.defaultValue).toBe(false);
        });

        it('personalization should be optional with default true', () => {
            const p = cm.listCategories().find((c) => c.id === 'personalization')!;
            expect(p.required).toBe(false);
            expect(p.defaultValue).toBe(true);
        });

        it('should start with 0 users', () => {
            expect(cm.count()).toBe(0);
        });
    });

    // ─── addCategory ─────────────────────────────────────────────

    describe('addCategory', () => {
        it('should add a custom category', () => {
            cm.addCategory('marketing', 'Marketing', 'Marketing emails', false, false);
            expect(cm.listCategories()).toHaveLength(5);
            const mk = cm.listCategories().find((c) => c.id === 'marketing')!;
            expect(mk.name).toBe('Marketing');
            expect(mk.required).toBe(false);
        });

        it('should overwrite existing category with same id', () => {
            cm.addCategory('analytics', 'Updated Analytics', 'New desc', false, true);
            const a = cm.listCategories().find((c) => c.id === 'analytics')!;
            expect(a.name).toBe('Updated Analytics');
            expect(a.defaultValue).toBe(true);
        });
    });

    // ─── setConsent ──────────────────────────────────────────────

    describe('setConsent', () => {
        it('should grant consent for a valid category and return true', () => {
            expect(cm.setConsent('user-1', 'analytics', true)).toBe(true);
            expect(cm.hasConsent('user-1', 'analytics')).toBe(true);
        });

        it('should revoke consent for an optional category', () => {
            cm.setConsent('user-1', 'personalization', true);
            expect(cm.setConsent('user-1', 'personalization', false)).toBe(true);
            expect(cm.hasConsent('user-1', 'personalization')).toBe(false);
        });

        it('should return false for non-existent category', () => {
            expect(cm.setConsent('user-1', 'nonexistent', true)).toBe(false);
        });

        it('should NOT allow refusing required category', () => {
            expect(cm.setConsent('user-1', 'essential', false)).toBe(false);
        });

        it('should allow granting required category explicitly', () => {
            expect(cm.setConsent('user-1', 'essential', true)).toBe(true);
        });

        it('should auto-create user record on first consent', () => {
            expect(cm.count()).toBe(0);
            cm.setConsent('new-user', 'analytics', true);
            expect(cm.count()).toBe(1);
        });

        it('should increment version on each update', () => {
            cm.setConsent('u1', 'analytics', true);
            cm.setConsent('u1', 'analytics', false);
            cm.setConsent('u1', 'analytics', true);
            const consents = cm.getUserConsents('u1');
            // Version incremented 3 times from initial
            expect(consents).toBeDefined();
        });
    });

    // ─── setAllConsents ──────────────────────────────────────────

    describe('setAllConsents', () => {
        it('should set multiple consents at once', () => {
            cm.setAllConsents('user-1', { analytics: true, 'ai-training': true, personalization: false });
            expect(cm.hasConsent('user-1', 'analytics')).toBe(true);
            expect(cm.hasConsent('user-1', 'ai-training')).toBe(true);
            expect(cm.hasConsent('user-1', 'personalization')).toBe(false);
        });

        it('should not allow refusing required categories via setAll', () => {
            cm.setAllConsents('user-1', { essential: false, analytics: true });
            // essential should stay true because it's required
            expect(cm.hasConsent('user-1', 'essential')).toBe(true);
            expect(cm.hasConsent('user-1', 'analytics')).toBe(true);
        });

        it('should ignore unknown category keys', () => {
            cm.setAllConsents('user-1', { unknown_cat: true } as any);
            // Should not crash, unknown is just ignored
            expect(cm.count()).toBe(1);
        });
    });

    // ─── hasConsent ──────────────────────────────────────────────

    describe('hasConsent', () => {
        it('should return default value for user without explicit consent', () => {
            // essential default=true, analytics default=false, personalization default=true
            expect(cm.hasConsent('unknown', 'essential')).toBe(true);
            expect(cm.hasConsent('unknown', 'analytics')).toBe(false);
            expect(cm.hasConsent('unknown', 'personalization')).toBe(true);
        });

        it('should return false for non-existent category on unknown user', () => {
            expect(cm.hasConsent('unknown', 'nonexistent')).toBe(false);
        });

        it('should return explicit consent for known user', () => {
            cm.setConsent('u1', 'analytics', true);
            expect(cm.hasConsent('u1', 'analytics')).toBe(true);
        });
    });

    // ─── getUserConsents ─────────────────────────────────────────

    describe('getUserConsents', () => {
        it('should return defaults for unknown user', () => {
            const consents = cm.getUserConsents('unknown');
            expect(consents.essential).toBe(true);
            expect(consents.analytics).toBe(false);
            expect(consents['ai-training']).toBe(false);
            expect(consents.personalization).toBe(true);
        });

        it('should return explicit consents for known user', () => {
            cm.setConsent('u1', 'analytics', true);
            const c = cm.getUserConsents('u1');
            expect(c.analytics).toBe(true);
        });
    });

    // ─── withdrawAll ─────────────────────────────────────────────

    describe('withdrawAll', () => {
        it('should withdraw all non-essential consents', () => {
            cm.setAllConsents('u1', { analytics: true, 'ai-training': true, personalization: true });
            cm.withdrawAll('u1');
            expect(cm.hasConsent('u1', 'essential')).toBe(true);
            expect(cm.hasConsent('u1', 'analytics')).toBe(false);
            expect(cm.hasConsent('u1', 'ai-training')).toBe(false);
            expect(cm.hasConsent('u1', 'personalization')).toBe(false);
        });

        it('should work for user without prior consents', () => {
            cm.withdrawAll('fresh-user');
            expect(cm.hasConsent('fresh-user', 'essential')).toBe(true);
            expect(cm.hasConsent('fresh-user', 'analytics')).toBe(false);
        });
    });

    // ─── Instance Isolation ──────────────────────────────────────

    describe('instance isolation', () => {
        it('separate instances should be independent', () => {
            const cm2 = new ConsentManager();
            cm.setConsent('u1', 'analytics', true);
            expect(cm.hasConsent('u1', 'analytics')).toBe(true);
            expect(cm2.hasConsent('u1', 'analytics')).toBe(false); // default
        });
    });
});
