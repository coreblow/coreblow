// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlags } from './feature-flags.js';

describe('Feature Flags — Phase 16', () => {
    let flags: FeatureFlags;

    beforeEach(() => {
        flags = new FeatureFlags();
    });

    it('defines a flag', () => {
        flags.define('dark-mode', 'Dark Mode');
        expect(flags.count()).toBe(1);
        expect(flags.get('dark-mode')!.name).toBe('Dark Mode');
        expect(flags.get('dark-mode')!.enabled).toBe(false);
    });

    it('defines enabled flag', () => {
        flags.define('beta', 'Beta Features', true);
        expect(flags.isEnabled('beta')).toBe(true);
    });

    it('undefined flag returns false', () => {
        expect(flags.isEnabled('nonexistent')).toBe(false);
    });

    it('disabled flag returns false', () => {
        flags.define('feat', 'Feature', false);
        expect(flags.isEnabled('feat')).toBe(false);
    });

    it('toggles flag', () => {
        flags.define('feat', 'Feature', false);
        flags.toggle('feat');
        expect(flags.isEnabled('feat')).toBe(true);
        flags.toggle('feat');
        expect(flags.isEnabled('feat')).toBe(false);
    });

    it('toggle returns false for unknown', () => {
        expect(flags.toggle('nope')).toBe(false);
    });

    it('setEnabled changes state', () => {
        flags.define('feat', 'Feature', false);
        flags.setEnabled('feat', true);
        expect(flags.isEnabled('feat')).toBe(true);
    });

    it('user targeting allows targeted user', () => {
        flags.define('vip', 'VIP Feature', true, { targetUsers: ['user-1', 'user-2'] });
        expect(flags.isEnabled('vip', { userId: 'user-1' })).toBe(true);
        expect(flags.isEnabled('vip', { userId: 'user-3' })).toBe(false);
        expect(flags.isEnabled('vip')).toBe(false);
    });

    it('channel targeting allows targeted channel', () => {
        flags.define('ch', 'Channel Feature', true, { targetChannels: ['discord'] });
        expect(flags.isEnabled('ch', { channel: 'discord' })).toBe(true);
        expect(flags.isEnabled('ch', { channel: 'slack' })).toBe(false);
    });

    it('rollout percentage works', () => {
        flags.define('roll', 'Rollout', true, { rolloutPercent: 50 });
        // With userId, result is deterministic based on hash
        const result1 = flags.isEnabled('roll', { userId: 'user-a' });
        const result2 = flags.isEnabled('roll', { userId: 'user-a' });
        expect(result1).toBe(result2); // Deterministic
    });

    it('100% rollout always enabled', () => {
        flags.define('full', 'Full', true, { rolloutPercent: 100 });
        expect(flags.isEnabled('full', { userId: 'anyone' })).toBe(true);
    });

    it('setRollout clamps values', () => {
        flags.define('r', 'R', true);
        flags.setRollout('r', 150);
        expect(flags.get('r')!.rolloutPercent).toBe(100);
        flags.setRollout('r', -10);
        expect(flags.get('r')!.rolloutPercent).toBe(0);
    });

    it('delete removes flag', () => {
        flags.define('temp', 'Temp', true);
        expect(flags.delete('temp')).toBe(true);
        expect(flags.count()).toBe(0);
        expect(flags.delete('temp')).toBe(false);
    });

    it('list returns all flags', () => {
        flags.define('a', 'Alpha', true);
        flags.define('b', 'Beta', false);
        const list = flags.list();
        expect(list).toHaveLength(2);
        expect(list.find(f => f.id === 'a')!.enabled).toBe(true);
    });

    it('get returns null for unknown', () => {
        expect(flags.get('nonexistent')).toBeNull();
    });
});
