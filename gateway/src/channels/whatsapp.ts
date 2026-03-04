/**
 * src/channels/whatsapp.ts
 * WhatsApp channel adapter using Baileys
 * Features: QR auth, anti-ban delays, auto-reconnect, DM + group, media
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { DedupCache } from '../utils/dedup.js';
import { createChildLogger } from '../utils/logger.js';
import path from 'node:path';
import fs from 'node:fs';
import { getHomeDir } from '../gateway/config.js';

const log = createChildLogger('channel:whatsapp');

export class WhatsAppChannel implements ChannelAdapter {
    name = 'whatsapp';
    private sock: any = null;
    private connected = false;
    private startedAt = 0;
    private router?: MessageRouter;
    private dedup = new DedupCache(60_000);
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;

    async start(router: MessageRouter) {
        this.router = router;

        try {
            // Dynamic import Baileys (optional dependency)
            const {
                default: makeWASocket,
                useMultiFileAuthState,
                DisconnectReason,
                fetchLatestBaileysVersion,
                makeCacheableSignalKeyStore,
            } = await import('@whiskeysockets/baileys');

            const authDir = path.join(getHomeDir(), 'auth', 'whatsapp');
            fs.mkdirSync(authDir, { recursive: true });

            const { state, saveCreds } = await useMultiFileAuthState(authDir);
            const { version } = await fetchLatestBaileysVersion();

            const sock = makeWASocket({
                version,
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, log as any),
                },
                printQRInTerminal: true,
                browser: ['CoreBlow Gateway', 'Chrome', '120.0.0'],
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
            });

            this.sock = sock;

            // Connection events
            sock.ev.on('connection.update', (update: any) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    log.info('📱 Scan QR code in terminal to connect WhatsApp');
                }

                if (connection === 'close') {
                    this.connected = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        const delay = Math.min(5000 * this.reconnectAttempts, 60000);
                        log.warn({ attempt: this.reconnectAttempts, delay }, 'Reconnecting WhatsApp...');
                        setTimeout(() => this.start(router), delay);
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        log.error('WhatsApp logged out. Delete auth folder and restart to re-scan QR.');
                    } else {
                        log.error({ attempts: this.reconnectAttempts }, 'Max reconnect attempts reached');
                    }
                }

                if (connection === 'open') {
                    this.connected = true;
                    this.startedAt = Date.now();
                    this.reconnectAttempts = 0;
                    log.info('✅ WhatsApp connected');
                }
            });

            // Save credentials on update
            sock.ev.on('creds.update', saveCreds);

            // Handle incoming messages
            sock.ev.on('messages.upsert', async ({ messages: msgs, type }: any) => {
                if (type !== 'notify') return;

                for (const msg of msgs) {
                    try {
                        await this.handleMessage(msg);
                    } catch (err: any) {
                        log.error({ err: err.message, msgId: msg.key.id }, 'Error handling WhatsApp message');
                    }
                }
            });

            // Register sender
            router.registerChannelSender('whatsapp', async (outMsg) => {
                const jid = outMsg.groupId || `${outMsg.senderId}@s.whatsapp.net`;
                const chunks = chunkMessage(outMsg.text, 4000);

                for (let i = 0; i < chunks.length; i++) {
                    // Anti-ban: small delay between chunks
                    if (i > 0) await this.delay(500 + Math.random() * 1000);

                    await sock.sendMessage(jid, { text: chunks[i] });
                }
            });

        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start WhatsApp channel');
            throw err;
        }
    }

    private async handleMessage(msg: any) {
        // Skip own messages, status broadcasts, reactions
        if (msg.key.fromMe) return;
        if (msg.key.remoteJid === 'status@broadcast') return;
        if (msg.message?.reactionMessage) return;
        if (!msg.message) return;

        // Dedup check
        const dedupKey = DedupCache.key(
            'whatsapp',
            msg.key.participant || msg.key.remoteJid || '',
            this.extractText(msg) || '',
            msg.messageTimestamp ? msg.messageTimestamp * 1000 : undefined
        );
        if (this.dedup.isDuplicate(dedupKey)) return;

        const text = this.extractText(msg);
        if (!text) return; // Skip non-text (media-only) for now

        const jid = msg.key.remoteJid || '';
        const isGroup = jid.endsWith('@g.us');
        const senderId = isGroup
            ? (msg.key.participant || '').replace('@s.whatsapp.net', '')
            : jid.replace('@s.whatsapp.net', '');

        // In groups, only respond if mentioned or replied to
        if (isGroup) {
            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const isReplyToMe = msg.message?.extendedTextMessage?.contextInfo?.participant?.includes(this.sock?.user?.id?.split(':')[0]);
            const isMentioned = mentionedJids.some((j: string) =>
                j.includes(this.sock?.user?.id?.split(':')[0] || '__none__')
            );

            if (!isMentioned && !isReplyToMe) return;
        }

        // Get sender name
        let senderName = 'User';
        try {
            if (isGroup && msg.key.participant) {
                senderName = msg.pushName || senderId;
            } else {
                senderName = msg.pushName || senderId;
            }
        } catch { /* use default */ }

        const inbound = {
            channel: 'whatsapp' as const,
            senderId,
            senderName,
            sessionId: MessageRouter.deriveSessionId(
                'whatsapp',
                senderId,
                isGroup ? jid : undefined
            ),
            groupId: isGroup ? jid : undefined,
            text,
            timestamp: msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now(),
            raw: msg,
        };

        // Anti-ban: simulate "typing" before responding
        if (this.sock) {
            await this.sock.presenceSubscribe(jid);
            await this.delay(300 + Math.random() * 700);
            await this.sock.sendPresenceUpdate('composing', jid);
        }

        await this.router!.routeInbound(inbound);

        // Stop typing indicator
        if (this.sock) {
            await this.sock.sendPresenceUpdate('paused', jid);
        }
    }

    private extractText(msg: any): string | null {
        if (msg.message?.conversation) return msg.message.conversation;
        if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
        if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
        if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
        if (msg.message?.documentMessage?.caption) return msg.message.documentMessage.caption;
        return null;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async stop() {
        if (this.sock) {
            this.sock.end(undefined);
            this.connected = false;
            this.dedup.destroy();
            log.info('WhatsApp disconnected');
        }
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'whatsapp',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
            details: {
                reconnectAttempts: this.reconnectAttempts,
            },
        };
    }
}
