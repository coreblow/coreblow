/**
 * CoreBlow Phase 36 — CommandCooldown & AutoComplete Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Cooldown: check, remaining, different users/commands
 *   - AutoComplete: setCommands, complete, partial matches
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandCooldown } from '../../src/commands/cooldown.js';
import { AutoComplete } from '../../src/commands/autocomplete.js';

// ================================================================
describe('CommandCooldown — Extended', () => {
    it('should allow first command', () => {
        const cd = new CommandCooldown(1000);
        expect(cd.check('user-1', 'help')).toBe(true);
    });

    it('should block rapid repeat of same command', () => {
        const cd = new CommandCooldown(1000);
        cd.check('user-1', 'help');
        expect(cd.check('user-1', 'help')).toBe(false);
    });

    it('should allow different commands from same user', () => {
        const cd = new CommandCooldown(1000);
        cd.check('user-1', 'help');
        expect(cd.check('user-1', 'status')).toBe(true);
    });

    it('should allow same command from different users', () => {
        const cd = new CommandCooldown(1000);
        cd.check('user-1', 'help');
        expect(cd.check('user-2', 'help')).toBe(true);
    });

    it('should report remaining cooldown', () => {
        const cd = new CommandCooldown(5000);
        cd.check('user-1', 'help');
        const remaining = cd.remaining('user-1', 'help');
        expect(remaining).toBeGreaterThan(0);
        expect(remaining).toBeLessThanOrEqual(5000);
    });

    it('should report 0 remaining for unused command', () => {
        const cd = new CommandCooldown(1000);
        expect(cd.remaining('user-1', 'never-used')).toBe(0);
    });
});

// ================================================================
describe('AutoComplete — Extended', () => {
    let ac: AutoComplete;
    beforeEach(() => {
        ac = new AutoComplete();
        ac.setCommands(['help', 'history', 'status', 'stop', 'start', 'model']);
    });

    it('should complete partial match', () => {
        const results = ac.complete('he');
        expect(results).toEqual(['help']);
    });

    it('should return multiple matches', () => {
        const results = ac.complete('st');
        expect(results).toContain('status');
        expect(results).toContain('stop');
        expect(results).toContain('start');
    });

    it('should return empty for no match', () => {
        expect(ac.complete('xyz')).toHaveLength(0);
    });

    it('should return all on empty prefix', () => {
        const results = ac.complete('');
        expect(results).toHaveLength(6);
    });

    it('should return sorted results', () => {
        const results = ac.complete('st');
        expect(results).toEqual([...results].sort());
    });

    it('should return empty args completion by default', () => {
        expect(ac.completeArgs('help', '')).toHaveLength(0);
    });
});
