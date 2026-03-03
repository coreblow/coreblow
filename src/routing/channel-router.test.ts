import { describe, it, expect } from 'vitest';
import { ChannelRouter } from './channel-router.js';

describe('ChannelRouter', () => {
    it('should register and route', async () => {
        const router = new ChannelRouter();
        router.register('discord', async (msg: any) => `discord: ${msg}`);
        const result = await router.route('discord', 'hello');
        expect(result).toBe('discord: hello');
    });

    it('should return null for unknown channel', async () => {
        const router = new ChannelRouter();
        expect(await router.route('unknown', 'msg')).toBeNull();
    });

    it('should check channel existence', () => {
        const router = new ChannelRouter();
        router.register('slack', async () => {});
        expect(router.hasChannel('slack')).toBe(true);
        expect(router.hasChannel('discord')).toBe(false);
    });
});
