/**
 * src/channels/matrix.ts
 * Matrix channel adapter — via matrix-js-sdk
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:matrix');

export interface MatrixConfig {
    homeserverUrl: string;     // e.g. https://matrix.org
    accessToken: string;
    userId: string;            // e.g. @coreblow:matrix.org
    autoJoin?: boolean;
}

export class MatrixChannel implements ChannelAdapter {
    name = 'matrix';
    private client: any = null;
    private config: MatrixConfig;
    private connected = false;
    private startedAt = 0;

    constructor(config: MatrixConfig) {
        this.config = config;
    }

    async start(router: MessageRouter) {
        try {
            const sdk = await import('matrix-js-sdk');

            this.client = sdk.createClient({
                baseUrl: this.config.homeserverUrl,
                accessToken: this.config.accessToken,
                userId: this.config.userId,
            });

            // Auto-join room invites
            if (this.config.autoJoin !== false) {
                this.client.on('RoomMember.membership', (event: any, member: any) => {
                    if (member.membership === 'invite' && member.userId === this.config.userId) {
                        this.client.joinRoom(member.roomId);
                        log.info({ roomId: member.roomId }, 'Auto-joined Matrix room');
                    }
                });
            }

            // Handle messages
            this.client.on('Room.timeline', async (event: any, room: any) => {
                if (event.getType() !== 'm.room.message') return;
                if (event.getSender() === this.config.userId) return;  // skip own messages

                const content = event.getContent();
                if (content.msgtype !== 'm.text') return;

                const text = content.body || '';
                if (!text.trim()) return;

                // In rooms with multiple users, only respond to mentions
                const members = room.getJoinedMembers();
                const isDM = members.length <= 2;
                if (!isDM && !text.includes(this.config.userId.split(':')[0])) return;

                const cleanText = text.replace(new RegExp(this.config.userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();

                const inbound = {
                    channel: 'matrix' as const,
                    senderId: event.getSender(),
                    senderName: event.getSender().split(':')[0].replace('@', ''),
                    sessionId: MessageRouter.deriveSessionId('matrix', event.getSender(), room.roomId),
                    groupId: isDM ? undefined : room.roomId,
                    text: cleanText || text,
                    timestamp: event.getTs() || Date.now(),
                    raw: event,
                };

                await router.routeInbound(inbound);
            });

            // Register sender
            router.registerChannelSender('matrix', async (msg) => {
                const roomId = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 4000);

                for (const chunk of chunks) {
                    await this.client.sendMessage(roomId, {
                        msgtype: 'm.text',
                        body: chunk,
                        format: 'org.matrix.custom.html',
                        formatted_body: chunk.replace(/\n/g, '<br>'),
                    });
                }
            });

            await this.client.startClient({ initialSyncLimit: 10 });
            this.connected = true;
            this.startedAt = Date.now();
            log.info({ userId: this.config.userId }, 'Matrix channel started');

        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Matrix channel');
            throw err;
        }
    }

    async stop() {
        if (this.client) {
            this.client.stopClient();
            this.connected = false;
        }
    }

    isConnected() { return this.connected; }

    getStatus(): ChannelStatus {
        return { name: 'matrix', connected: this.connected, uptime: this.connected ? Date.now() - this.startedAt : 0 };
    }
}
