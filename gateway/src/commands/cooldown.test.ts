/**
 * commands/cooldown.test.ts — Command cooldown tests
 */
import { describe, it, expect } from 'vitest';
import { CommandCooldown } from './cooldown.js';

describe('CommandCooldown', () => {
    it('should allow first call', () => {
        const cd = new CommandCooldown(1000);
        expect(cd.check('u1', 'help')).toBe(true);
    });

    it('should block rapid calls', () => {
        const cd = new CommandCooldown(1000);
        cd.check('u1', 'help');
        expect(cd.check('u1', 'help')).toBe(false);
    });

    it('should track different users independently', () => {
        const cd = new CommandCooldown(1000);
        cd.check('u1', 'help');
        expect(cd.check('u2', 'help')).toBe(true);
    });

    it('should return remaining time', () => {
        const cd = new CommandCooldown(1000);
        cd.check('u1', 'help');
        expect(cd.remaining('u1', 'help')).toBeGreaterThan(0);
        expect(cd.remaining('u2', 'help')).toBe(0);
    });
});
