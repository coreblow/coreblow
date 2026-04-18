/**
 * Tests for Wave 2 Config Modules (Part 2):
 * Channel Config, Identity/Avatar, Thread Binding
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ─── Channel Config Tests ────────────────────────────────────────

import {
    validateChannelConfig,
    validateAllChannels,
    getChannelSchema,
    listChannelSchemas,
    getRegisteredChannelIds,
    isChannelConfigured,
    getChannelCapabilities,
    channelHasCapability,
    registerChannelSchema,
} from './channel-config.js';

describe('Channel Config Validation', () => {
    it('should validate telegram config with required fields', () => {
        const result = validateChannelConfig('telegram', { token: 'bot123:abc' });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should fail telegram without token', () => {
        const result = validateChannelConfig('telegram', {});
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.field === 'token')).toBe(true);
    });

    it('should validate discord config', () => {
        const result = validateChannelConfig('discord', { token: 'disc-token-123' });
        expect(result.valid).toBe(true);
    });

    it('should validate slack config with both required fields', () => {
        const valid = validateChannelConfig('slack', { botToken: 'xoxb-123', signingSecret: 'sec' });
        expect(valid.valid).toBe(true);

        const invalid = validateChannelConfig('slack', { botToken: 'xoxb-123' });
        expect(invalid.valid).toBe(false);
    });

    it('should validate whatsapp config', () => {
        const result = validateChannelConfig('whatsapp', { phoneNumberId: '123', accessToken: 'token' });
        expect(result.valid).toBe(true);
    });

    it('should pass unknown channels with warning', () => {
        const result = validateChannelConfig('custom-channel', { foo: 'bar' });
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should detect type mismatches', () => {
        const result = validateChannelConfig('web', { port: 'not-a-number' });
        expect(result.errors.some((e) => e.field === 'port')).toBe(true);
    });

    it('should warn about unknown fields', () => {
        const result = validateChannelConfig('telegram', { token: 'bot123', unknownField: true });
        expect(result.warnings.some((w) => w.includes('unknownField'))).toBe(true);
    });

    it('should validate all channels at once', () => {
        const results = validateAllChannels({
            telegram: { token: 'bot123' },
            discord: {},
        });
        expect(results).toHaveLength(2);
        expect(results[0]!.valid).toBe(true);
        expect(results[1]!.valid).toBe(false);
    });

    it('should check if channel is configured', () => {
        expect(isChannelConfigured('telegram', { token: 'bot123' })).toBe(true);
        expect(isChannelConfigured('telegram', {})).toBe(false);
        expect(isChannelConfigured('telegram', undefined)).toBe(false);
    });
});

describe('Channel Schema Registry', () => {
    it('should list built-in schemas', () => {
        const schemas = listChannelSchemas();
        expect(schemas.length).toBeGreaterThanOrEqual(6);
    });

    it('should get schema by id', () => {
        const schema = getChannelSchema('telegram');
        expect(schema).toBeDefined();
        expect(schema!.displayName).toBe('Telegram');
    });

    it('should list registered channel IDs', () => {
        const ids = getRegisteredChannelIds();
        expect(ids).toContain('telegram');
        expect(ids).toContain('discord');
        expect(ids).toContain('web');
        expect(ids).toContain('api');
    });

    it('should register custom channel schema', () => {
        registerChannelSchema({
            channelId: 'test-channel',
            displayName: 'Test',
            description: 'Test channel',
            requiredFields: [{ name: 'key', type: 'string', description: 'API key', required: true }],
            optionalFields: [],
            capabilities: ['text'],
        });
        expect(getChannelSchema('test-channel')).toBeDefined();
    });
});

describe('Channel Capabilities', () => {
    it('should return capabilities for known channels', () => {
        const caps = getChannelCapabilities('telegram');
        expect(caps).toContain('text');
        expect(caps).toContain('images');
        expect(caps).toContain('markdown');
    });

    it('should check specific capability', () => {
        expect(channelHasCapability('discord', 'threads')).toBe(true);
        expect(channelHasCapability('discord', 'voice')).toBe(false);
        expect(channelHasCapability('web', 'streaming')).toBe(true);
    });

    it('should return empty for unknown channels', () => {
        expect(getChannelCapabilities('nonexistent')).toEqual([]);
    });
});

// ─── Identity/Avatar Tests ──────────────────────────────────────

import {
    registerProfile,
    getProfile,
    listProfiles,
    clearProfiles,
    resolveIdentity,
    setDefaultProfile,
    parseAvatar,
    validateAvatar,
    createIdentity,
    isHttpUrl,
    isDataUri,
    isPathWithinRoot,
} from './identity-avatar.js';

describe('Identity & Avatar', () => {
    beforeEach(() => clearProfiles());

    it('should register and retrieve profiles', () => {
        registerProfile({ id: 'default', identity: { name: 'TestBot' } });
        expect(getProfile('default')).toBeDefined();
        expect(getProfile('default')!.identity.name).toBe('TestBot');
    });

    it('should list all profiles', () => {
        registerProfile({ id: 'p1', identity: { name: 'Bot1' } });
        registerProfile({ id: 'p2', identity: { name: 'Bot2' } });
        expect(listProfiles()).toHaveLength(2);
    });

    it('should resolve identity from default profile', () => {
        registerProfile({ id: 'default', identity: { name: 'MyBot', bio: 'Helpful' } });
        setDefaultProfile('default');
        const identity = resolveIdentity();
        expect(identity.name).toBe('MyBot');
    });

    it('should resolve channel-specific identity', () => {
        registerProfile({ id: 'tg-profile', identity: { name: 'TelegramBot' }, channels: ['telegram'] });
        registerProfile({ id: 'default', identity: { name: 'DefaultBot' } });
        setDefaultProfile('default');
        expect(resolveIdentity('telegram').name).toBe('TelegramBot');
        expect(resolveIdentity('discord').name).toBe('DefaultBot');
    });

    it('should return fallback when no profiles', () => {
        const identity = resolveIdentity();
        expect(identity.name).toBe('CoreBlow');
    });
});

describe('Avatar Validation', () => {
    it('should parse URL avatars', () => {
        const avatar = parseAvatar('https://example.com/image.png');
        expect(avatar.type).toBe('url');
    });

    it('should parse data URI avatars', () => {
        const avatar = parseAvatar('data:image/png;base64,abc123');
        expect(avatar.type).toBe('data-uri');
    });

    it('should parse file path avatars', () => {
        const avatar = parseAvatar('./assets/avatar.png');
        expect(avatar.type).toBe('file');
    });

    it('should handle empty/undefined', () => {
        expect(parseAvatar(undefined).type).toBe('none');
        expect(parseAvatar('').type).toBe('none');
    });

    it('should validate URL avatars', () => {
        const valid = validateAvatar({ type: 'url', value: 'https://example.com/img.png' });
        expect(valid.valid).toBe(true);

        const http = validateAvatar({ type: 'url', value: 'http://example.com/img.png' });
        expect(http.warnings.length).toBeGreaterThan(0);
    });

    it('should validate file path within root', () => {
        const inside = validateAvatar({ type: 'file', value: './assets/img.png' }, '/project');
        expect(inside.valid).toBe(true);

        const outside = validateAvatar({ type: 'file', value: '../../etc/passwd' }, '/project');
        expect(outside.valid).toBe(false);
    });

    it('should create identity with defaults', () => {
        const identity = createIdentity({ name: 'MyBot' });
        expect(identity.name).toBe('MyBot');
        expect(identity.language).toBe('en');
    });
});

describe('Avatar URL helpers', () => {
    it('should detect HTTP URLs', () => {
        expect(isHttpUrl('https://example.com')).toBe(true);
        expect(isHttpUrl('http://example.com')).toBe(true);
        expect(isHttpUrl('ftp://example.com')).toBe(false);
    });

    it('should detect data URIs', () => {
        expect(isDataUri('data:image/png;base64,abc')).toBe(true);
        expect(isDataUri('data:text/plain;base64,abc')).toBe(false);
    });

    it('should check path containment', () => {
        expect(isPathWithinRoot('sub/file.txt', '/root')).toBe(true);
        expect(isPathWithinRoot('../../etc/passwd', '/root')).toBe(false);
    });
});

// ─── Thread Binding Tests ────────────────────────────────────────

import {
    bindThread,
    getBinding,
    unbindThread,
    listBindings,
    clearBindings,
    resolveThreadModel,
    resolveThreadPrompt,
    cleanupExpired,
    getBindingStats,
} from './thread-binding.js';

describe('Thread Binding', () => {
    beforeEach(() => clearBindings());

    it('should bind and retrieve a thread', () => {
        bindThread('thread-1', 'telegram', { model: 'gpt-4o' });
        const binding = getBinding('thread-1');
        expect(binding).toBeDefined();
        expect(binding!.model).toBe('gpt-4o');
        expect(binding!.channelId).toBe('telegram');
    });

    it('should update existing binding', () => {
        bindThread('thread-1', 'telegram', { model: 'gpt-4o' });
        bindThread('thread-1', 'telegram', { model: 'claude-3' });
        expect(getBinding('thread-1')!.model).toBe('claude-3');
    });

    it('should unbind threads', () => {
        bindThread('thread-1', 'telegram');
        expect(unbindThread('thread-1')).toBe(true);
        expect(getBinding('thread-1')).toBeUndefined();
    });

    it('should list bindings', () => {
        bindThread('t1', 'telegram');
        bindThread('t2', 'discord');
        bindThread('t3', 'telegram');
        expect(listBindings()).toHaveLength(3);
        expect(listBindings('telegram')).toHaveLength(2);
    });

    it('should clear bindings by channel', () => {
        bindThread('t1', 'telegram');
        bindThread('t2', 'discord');
        clearBindings('telegram');
        expect(listBindings()).toHaveLength(1);
    });

    it('should resolve thread model with fallback', () => {
        bindThread('t1', 'telegram', { model: 'gpt-4o' });
        expect(resolveThreadModel('t1', 'default-model')).toBe('gpt-4o');
        expect(resolveThreadModel('nonexistent', 'default-model')).toBe('default-model');
    });

    it('should resolve thread prompt with fallback', () => {
        bindThread('t1', 'telegram', { systemPrompt: 'Be brief' });
        expect(resolveThreadPrompt('t1', 'default')).toBe('Be brief');
        expect(resolveThreadPrompt('nope', 'default')).toBe('default');
    });

    it('should respect TTL expiry', () => {
        bindThread('exp-thread', 'telegram', {}, { ttlMs: 1 });
        // Wait briefly for expiry
        const start = Date.now();
        while (Date.now() - start < 10) { /* */ }
        expect(getBinding('exp-thread')).toBeUndefined();
    });

    it('should cleanup expired bindings', () => {
        bindThread('exp1', 'telegram', {}, { ttlMs: 1 });
        bindThread('alive', 'discord');
        const start = Date.now();
        while (Date.now() - start < 10) { /* */ }
        const cleaned = cleanupExpired();
        expect(cleaned).toBe(1);
    });

    it('should inherit from existing binding', () => {
        bindThread('t1', 'telegram', { model: 'gpt-4o', systemPrompt: 'Be helpful' });
        bindThread('t1', 'telegram', { temperature: 0.5 }, { inherit: true });
        const binding = getBinding('t1')!;
        expect(binding.model).toBe('gpt-4o');
        expect(binding.temperature).toBe(0.5);
    });

    it('should report binding stats', () => {
        bindThread('s1', 'telegram');
        bindThread('s2', 'discord');
        const stats = getBindingStats();
        expect(stats.total).toBe(2);
        expect(stats.byChannel.telegram).toBe(1);
    });
});
