import { describe, it, expect } from 'vitest';
import { cleanupSessions } from './session-cleanup.js';

describe('Session Cleanup', () => {
    it('should clean expired sessions', () => {
        const sessions = new Map();
        sessions.set('old', { createdAt: Date.now() - 9999999 });
        sessions.set('new', { createdAt: Date.now() });
        const cleaned = cleanupSessions(sessions, 5000);
        expect(cleaned).toBe(1);
        expect(sessions.size).toBe(1);
        expect(sessions.has('new')).toBe(true);
    });

    it('should keep all if none expired', () => {
        const sessions = new Map();
        sessions.set('a', { createdAt: Date.now() });
        expect(cleanupSessions(sessions, 60000)).toBe(0);
    });

    it('should handle empty map', () => {
        expect(cleanupSessions(new Map(), 1000)).toBe(0);
    });
});
