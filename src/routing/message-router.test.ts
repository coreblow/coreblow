import { describe, it, expect } from 'vitest';
import { MessageRouter } from './message-router.js';

describe('MessageRouter', () => {
    it('should route matching pattern', async () => {
        const router = new MessageRouter();
        router.add('^/help', async () => 'help response');
        expect(await router.route('/help me', {})).toBe('help response');
    });

    it('should return null on no match', async () => {
        const router = new MessageRouter();
        router.add('^/help', async () => 'help');
        expect(await router.route('hello', {})).toBeNull();
    });
});
