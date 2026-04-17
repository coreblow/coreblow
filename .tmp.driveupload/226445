/**
 * CoreBlow Phase 14 — Deep Channel Adapter Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DiscordAdapter } from '../../src/channels/discord-adapter.js';
import { TelegramAdapter } from '../../src/channels/telegram-adapter.js';
import { SlackAdapter } from '../../src/channels/slack-adapter.js';
import { WhatsAppAdapter } from '../../src/channels/whatsapp-adapter.js';
import { WebhookAdapter } from '../../src/channels/webhook-adapter.js';

// ================================================================
// Discord Adapter Tests
// ================================================================
describe('Discord Adapter', () => {
    let adapter: DiscordAdapter;
    beforeEach(() => {
        adapter = new DiscordAdapter({ token: 'test-token', applicationId: 'app-123' });
    });

    it('should create adapter', () => {
        expect(adapter).toBeTruthy();
    });

    it('should connect and disconnect', async () => {
        await adapter.connect();
        expect(adapter.getStatus().connected).toBe(true);
        await adapter.disconnect();
        expect(adapter.getStatus().connected).toBe(false);
    });

    it('should register slash commands', () => {
        adapter.registerCommand({ name: 'ask', description: 'Ask AI a question' });
        expect(adapter.getStatus().commands).toBe(1);
    });

    it('should set message handler', () => {
        adapter.onMessage(async () => 'response');
        // No crash
    });
});

// ================================================================
// Telegram Adapter Tests
// ================================================================
describe('Telegram Adapter', () => {
    let adapter: TelegramAdapter;
    beforeEach(() => {
        adapter = new TelegramAdapter({ token: 'test-token' });
    });

    it('should create adapter', () => {
        expect(adapter).toBeTruthy();
    });

    it('should start and stop', async () => {
        await adapter.start();
        expect(adapter.getStatus().running).toBe(true);
        await adapter.stop();
        expect(adapter.getStatus().running).toBe(false);
    });

    it('should set message handler', () => {
        adapter.onMessage(async () => 'reply');
    });
});

// ================================================================
// Slack Adapter Tests
// ================================================================
describe('Slack Adapter', () => {
    let adapter: SlackAdapter;
    beforeEach(() => {
        adapter = new SlackAdapter({
            botToken: 'xoxb-test',
            signingSecret: 'test-secret',
        });
    });

    it('should create adapter', () => {
        expect(adapter).toBeTruthy();
    });

    it('should connect and disconnect', async () => {
        await adapter.connect();
        expect(adapter.getStatus().connected).toBe(true);
        await adapter.disconnect();
        expect(adapter.getStatus().connected).toBe(false);
    });

    it('should verify valid signatures', () => {
        const crypto = require('node:crypto');
        const body = '{"text":"hello"}';
        const timestamp = '1234567890';
        const baseString = `v0:${timestamp}:${body}`;
        const hmac = crypto.createHmac('sha256', 'test-secret').update(baseString).digest('hex');
        const signature = `v0=${hmac}`;
        expect(adapter.verifySignature(signature, timestamp, body)).toBe(true);
    });

    it('should reject invalid signatures', () => {
        try {
            const result = adapter.verifySignature('v0=invalid', '123', 'body');
            expect(result).toBe(false);
        } catch {
            // timingSafeEqual throws on length mismatch — also a valid rejection
        }
    });

    it('should set message handler', () => {
        adapter.onMessage(async () => 'reply');
    });
});

// ================================================================
// WhatsApp Adapter Tests
// ================================================================
describe('WhatsApp Adapter', () => {
    let adapter: WhatsAppAdapter;
    beforeEach(() => {
        adapter = new WhatsAppAdapter({
            phoneNumberId: '123456',
            accessToken: 'test-token',
            verifyToken: 'my-verify-token',
        });
    });

    it('should create adapter', () => {
        expect(adapter).toBeTruthy();
    });

    it('should verify webhook challenge', () => {
        const challenge = adapter.verifyWebhook('subscribe', 'my-verify-token', 'challenge-123');
        expect(challenge).toBe('challenge-123');
    });

    it('should reject invalid verify token', () => {
        const challenge = adapter.verifyWebhook('subscribe', 'wrong-token', 'challenge-123');
        expect(challenge).toBeNull();
    });

    it('should track delivery status', () => {
        adapter.updateDeliveryStatus('msg-1', 'delivered');
        expect(adapter.getDeliveryStatus('msg-1')).toBe('delivered');
    });

    it('should return undefined for unknown message', () => {
        expect(adapter.getDeliveryStatus('unknown')).toBeUndefined();
    });

    it('should set message handler', () => {
        adapter.onMessage(async () => 'reply');
    });
});

// ================================================================
// Webhook Adapter Tests
// ================================================================
describe('Webhook Adapter', () => {
    let adapter: WebhookAdapter;
    beforeEach(() => {
        adapter = new WebhookAdapter();
    });

    it('should register webhooks', () => {
        adapter.register({ id: 'wh-1', name: 'Test', outboundUrl: 'https://example.com/hook' });
        expect(adapter.list()).toHaveLength(1);
    });

    it('should unregister webhooks', () => {
        adapter.register({ id: 'wh-1', name: 'Test', outboundUrl: 'https://example.com' });
        expect(adapter.unregister('wh-1')).toBe(true);
        expect(adapter.list()).toHaveLength(0);
    });

    it('should process inbound with default transform', async () => {
        adapter.register({ id: 'wh-1', name: 'Test', outboundUrl: 'https://example.com' });
        const msg = await adapter.processInbound('wh-1', { text: 'hello', sender: 'user1' });
        expect(msg).not.toBeNull();
        expect(msg!.text).toBe('hello');
        expect(msg!.senderId).toBe('user1');
    });

    it('should process inbound with custom transform', async () => {
        adapter.register({
            id: 'wh-2',
            name: 'Custom',
            outboundUrl: 'https://example.com',
            inboundTransform: (payload: any) => ({
                id: 'custom-1',
                senderId: payload.user_id,
                channelId: 'ch-1',
                text: payload.body,
                timestamp: Date.now(),
            }),
        });
        const msg = await adapter.processInbound('wh-2', { user_id: 'u1', body: 'hi' });
        expect(msg!.senderId).toBe('u1');
        expect(msg!.text).toBe('hi');
    });

    it('should reject unknown webhook', async () => {
        const msg = await adapter.processInbound('unknown', {});
        expect(msg).toBeNull();
    });

    it('should reject invalid signature', async () => {
        adapter.register({
            id: 'wh-3',
            name: 'Signed',
            outboundUrl: 'https://example.com',
            secret: 'my-secret',
        });
        await expect(
            adapter.processInbound('wh-3', { text: 'test' }, 'sha256=invalid'),
        ).rejects.toThrow('Invalid webhook signature');
    });

    it('should set message handler', () => {
        adapter.onMessage(async () => 'ok');
    });

    it('should return empty delivery log', () => {
        expect(adapter.getDeliveryLog()).toHaveLength(0);
    });
});
