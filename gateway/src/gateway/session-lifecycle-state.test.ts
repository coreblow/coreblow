/**
 * Session lifecycle state machine tests
 */
import { describe, it, expect } from 'vitest';
import { SessionLifecycle } from './session-lifecycle-state.js';

describe('SessionLifecycle', () => {
    it('should start in created state', () => {
        const lc = new SessionLifecycle();
        expect(lc.state).toBe('created');
    });

    it('should allow valid transitions', () => {
        const lc = new SessionLifecycle();
        expect(lc.transition('idle')).toBe(true);
        expect(lc.state).toBe('idle');
        expect(lc.transition('active')).toBe(true);
        expect(lc.state).toBe('active');
    });

    it('should reject invalid transitions', () => {
        const lc = new SessionLifecycle();
        expect(lc.transition('archived')).toBe(false);
        expect(lc.state).toBe('created');
    });

    it('should track history', () => {
        const lc = new SessionLifecycle();
        lc.transition('idle');
        lc.transition('active');
        expect(lc.history).toHaveLength(2);
        expect(lc.history[0].from).toBe('created');
        expect(lc.history[0].to).toBe('idle');
    });

    it('should detect terminal state', () => {
        const lc = new SessionLifecycle();
        lc.transition('idle');
        lc.transition('archived');
        expect(lc.isTerminal).toBe(true);
    });

    it('should detect active state', () => {
        const lc = new SessionLifecycle();
        lc.transition('active');
        expect(lc.isActive).toBe(true);
        lc.transition('streaming');
        expect(lc.isActive).toBe(true);
    });

    it('should detect waiting state', () => {
        const lc = new SessionLifecycle();
        lc.transition('active');
        lc.transition('waiting_approval');
        expect(lc.isWaiting).toBe(true);
    });

    it('should check canTransition without performing it', () => {
        const lc = new SessionLifecycle();
        expect(lc.canTransition('idle')).toBe(true);
        expect(lc.canTransition('archived')).toBe(false);
        expect(lc.state).toBe('created'); // unchanged
    });
});
