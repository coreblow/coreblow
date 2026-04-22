/**
 * CoreBlow — Routing resolvePreferredAccountId Tests
 *
 * Tests for the pure account ID preference resolution function.
 */

import { describe, it, expect } from 'vitest';
import { resolvePreferredAccountId } from './bindings.js';

describe('resolvePreferredAccountId', () => {
    it('returns first bound account when available', () => {
        expect(resolvePreferredAccountId({
            accountIds: ['user-1', 'user-2'],
            defaultAccountId: 'default-user',
            boundAccounts: ['bound-1', 'bound-2'],
        })).toBe('bound-1');
    });

    it('returns default when no bound accounts', () => {
        expect(resolvePreferredAccountId({
            accountIds: ['user-1'],
            defaultAccountId: 'default-user',
            boundAccounts: [],
        })).toBe('default-user');
    });

    it('prefers bound over default even when default is in accountIds', () => {
        expect(resolvePreferredAccountId({
            accountIds: ['default-user', 'other'],
            defaultAccountId: 'default-user',
            boundAccounts: ['specific-bound'],
        })).toBe('specific-bound');
    });
});
