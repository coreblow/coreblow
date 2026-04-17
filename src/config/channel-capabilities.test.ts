/**
 * config/channel-capabilities.test.ts — Channel capabilities tests
 */
import { describe, it, expect } from 'vitest';
import { resolveChannelCapabilities, listKnownChannels, channelSupports } from './channel-capabilities.js';

describe('Channel Capabilities', () => {
    it('returns defaults for discord', () => {
        const caps = resolveChannelCapabilities({ channel: 'discord' });
        expect(caps.supportsAttachments).toBe(true);
        expect(caps.supportsReactions).toBe(true);
        expect(caps.supportsThreads).toBe(true);
        expect(caps.supportsRichEmbed).toBe(true);
        expect(caps.maxMessageLength).toBe(2000);
    });

    it('returns defaults for telegram', () => {
        const caps = resolveChannelCapabilities({ channel: 'telegram' });
        expect(caps.supportsThreads).toBe(false);
        expect(caps.maxMessageLength).toBe(4096);
    });

    it('returns defaults for signal', () => {
        const caps = resolveChannelCapabilities({ channel: 'signal' });
        expect(caps.supportsReactions).toBe(true);
        expect(caps.supportsTypingIndicator).toBe(false);
        expect(caps.supportsRichEmbed).toBe(false);
    });

    it('returns fallback for unknown channel', () => {
        const caps = resolveChannelCapabilities({ channel: 'unknown' });
        expect(caps.supportsAttachments).toBe(false);
        expect(caps.maxMessageLength).toBe(4096);
    });

    it('overrides with no-* capabilities', () => {
        const cfg = { channels: { discord: { capabilities: ['no-threads', 'no-voice'] } } };
        const caps = resolveChannelCapabilities({ cfg, channel: 'discord' });
        expect(caps.supportsThreads).toBe(false);
        expect(caps.supportsVoice).toBe(false);
        expect(caps.supportsAttachments).toBe(true); // unchanged
    });

    it('returns fallback when no channel specified', () => {
        const caps = resolveChannelCapabilities({});
        expect(caps.maxMessageLength).toBe(4096);
    });

    it('lists all known channels', () => {
        const channels = listKnownChannels();
        expect(channels).toContain('discord');
        expect(channels).toContain('telegram');
        expect(channels).toContain('slack');
        expect(channels).toContain('signal');
        expect(channels.length).toBeGreaterThanOrEqual(7);
    });

    it('channelSupports utility works', () => {
        expect(channelSupports('discord', 'supportsReactions')).toBe(true);
        expect(channelSupports('signal', 'supportsRichEmbed')).toBe(false);
    });
});
