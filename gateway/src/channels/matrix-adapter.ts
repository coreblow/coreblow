/**
 * CoreBlow — Matrix Channel Adapter
 *
 * Production adapter for Matrix protocol (Element/Synapse compatible).
 * Handles room management, messaging, events, and sync.
 * Uses raw Client-Server REST API — zero SDK dependency.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:matrix');

/** Matrix homeserver configuration */
export interface MatrixConfig {
    homeserverUrl: string;
    userId: string;
    accessToken: string;
    deviceId?: string;
    autoJoinInvites?: boolean;
    syncTimeoutMs?: number;
    filterRooms?: string[];
}

/** Matrix room event */
export interface MatrixEvent {
    type: string;
    eventId: string;
    roomId: string;
    sender: string;
    content: Record<string, unknown>;
    originServerTs: number;
    unsigned?: Record<string, unknown>;
}

/** Matrix room */
export interface MatrixRoom {
    roomId: string;
    name?: string;
    topic?: string;
    memberCount?: number;
    joined: boolean;
}

/** Matrix message handler */
export type MatrixMessageHandler = (event: {
    roomId: string;
    sender: string;
    body: string;
    eventId: string;
    formatted?: string;
    raw: MatrixEvent;
}) => Promise<string | void>;

/**
 * CoreBlow Matrix Adapter
 *
 * Communicates with Matrix homeserver via Client-Server API.
 * Supports long-poll sync for real-time events.
 */
export class MatrixAdapter {
    private config: MatrixConfig;
    private messageHandler: MatrixMessageHandler | null = null;
    private running = false;
    private syncToken: string | null = null;
    private syncAbort: AbortController | null = null;
    private joinedRooms = new Set<string>();

    constructor(config: MatrixConfig) {
        this.config = {
            autoJoinInvites: true,
            syncTimeoutMs: 30_000,
            ...config,
        };
    }

    onMessage(handler: MatrixMessageHandler): void {
        this.messageHandler = handler;
    }

    /** Connect and start syncing */
    async connect(): Promise<void> {
        // Verify credentials
        const whoami = await this.api('GET', '/_matrix/client/v3/account/whoami');
        log.info({ userId: whoami.user_id }, 'Matrix authenticated');

        // Get initial joined rooms
        const joined = await this.api('GET', '/_matrix/client/v3/joined_rooms');
        if (joined.joined_rooms) {
            for (const room of joined.joined_rooms as string[]) {
                this.joinedRooms.add(room);
            }
        }

        this.running = true;
        this.startSyncLoop();
        log.info({ homeserver: this.config.homeserverUrl, rooms: this.joinedRooms.size }, 'Matrix adapter connected');
    }

    /** Disconnect and stop syncing */
    async disconnect(): Promise<void> {
        this.running = false;
        this.syncAbort?.abort();
        this.syncAbort = null;
        this.joinedRooms.clear();
        log.info('Matrix adapter disconnected');
    }

    /** Send a text message to a room */
    async sendMessage(roomId: string, text: string): Promise<string> {
        const txnId = `m${Date.now()}${Math.random().toString(36).slice(2)}`;
        const data = await this.api(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
            {
                msgtype: 'm.text',
                body: text,
            },
        );
        return data.event_id as string;
    }

    /** Send a formatted (HTML) message */
    async sendFormattedMessage(roomId: string, text: string, html: string): Promise<string> {
        const txnId = `m${Date.now()}${Math.random().toString(36).slice(2)}`;
        const data = await this.api(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
            {
                msgtype: 'm.text',
                body: text,
                format: 'org.matrix.custom.html',
                formatted_body: html,
            },
        );
        return data.event_id as string;
    }

    /** Send a notice (non-highlighted message) */
    async sendNotice(roomId: string, text: string): Promise<string> {
        const txnId = `m${Date.now()}${Math.random().toString(36).slice(2)}`;
        const data = await this.api(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
            { msgtype: 'm.notice', body: text },
        );
        return data.event_id as string;
    }

    /** Join a room by ID or alias */
    async joinRoom(roomIdOrAlias: string): Promise<string> {
        const data = await this.api(
            'POST',
            `/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`,
            {},
        );
        const roomId = data.room_id as string;
        this.joinedRooms.add(roomId);
        return roomId;
    }

    /** Leave a room */
    async leaveRoom(roomId: string): Promise<void> {
        await this.api('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/leave`, {});
        this.joinedRooms.delete(roomId);
    }

    /** Set room topic */
    async setRoomTopic(roomId: string, topic: string): Promise<void> {
        await this.api(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.topic`,
            { topic },
        );
    }

    /** Get room members */
    async getRoomMembers(roomId: string): Promise<Array<{ userId: string; displayName?: string }>> {
        const data = await this.api(
            'GET',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/members`,
        );
        const members: Array<{ userId: string; displayName?: string }> = [];
        if (data.chunk) {
            for (const event of data.chunk as MatrixEvent[]) {
                if (event.content?.membership === 'join') {
                    members.push({
                        userId: event.sender,
                        displayName: event.content?.displayname as string | undefined,
                    });
                }
            }
        }
        return members;
    }

    /** Set typing indicator */
    async setTyping(roomId: string, typing: boolean, timeoutMs = 5000): Promise<void> {
        await this.api(
            'PUT',
            `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/typing/${encodeURIComponent(this.config.userId)}`,
            { typing, timeout: typing ? timeoutMs : undefined },
        );
    }

    /** Get adapter status */
    getStatus(): { running: boolean; homeserver: string; rooms: number; userId: string } {
        return {
            running: this.running,
            homeserver: this.config.homeserverUrl,
            rooms: this.joinedRooms.size,
            userId: this.config.userId,
        };
    }

    listJoinedRooms(): string[] {
        return [...this.joinedRooms];
    }

    // === Private ===

    private async startSyncLoop(): Promise<void> {
        while (this.running) {
            try {
                this.syncAbort = new AbortController();
                const params = new URLSearchParams({
                    timeout: String(this.config.syncTimeoutMs),
                });
                if (this.syncToken) params.set('since', this.syncToken);

                const data = await this.api('GET', `/_matrix/client/v3/sync?${params}`, undefined, this.syncAbort.signal);
                this.syncToken = data.next_batch as string;

                // Process room events
                const rooms = (data.rooms as Record<string, unknown>)?.join as Record<string, unknown> | undefined;
                if (rooms) {
                    for (const [roomId, roomData] of Object.entries(rooms)) {
                        const timeline = (roomData as Record<string, unknown>).timeline as { events?: MatrixEvent[] } | undefined;
                        if (!timeline?.events) continue;

                        for (const event of timeline.events) {
                            await this.handleEvent(roomId, event);
                        }
                    }
                }

                // Auto-join invites
                const invites = (data.rooms as Record<string, unknown>)?.invite as Record<string, unknown> | undefined;
                if (invites && this.config.autoJoinInvites) {
                    for (const roomId of Object.keys(invites)) {
                        try { await this.joinRoom(roomId); } catch { /* skip */ }
                    }
                }
            } catch (err) {
                if (this.running) {
                    log.warn({ err }, 'Matrix sync error — retrying in 5s');
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
        }
    }

    private async handleEvent(roomId: string, event: MatrixEvent): Promise<void> {
        if (event.type !== 'm.room.message') return;
        if (event.sender === this.config.userId) return; // Ignore own messages

        const body = event.content?.body as string | undefined;
        if (!body) return;

        if (this.config.filterRooms && !this.config.filterRooms.includes(roomId)) return;

        if (this.messageHandler) {
            const reply = await this.messageHandler({
                roomId,
                sender: event.sender,
                body,
                eventId: event.eventId,
                formatted: event.content?.formatted_body as string | undefined,
                raw: event,
            });
            if (reply) await this.sendMessage(roomId, reply);
        }
    }

    private async api(
        method: string,
        path: string,
        body?: unknown,
        signal?: AbortSignal,
    ): Promise<Record<string, unknown>> {
        const url = `${this.config.homeserverUrl}${path}`;
        const opts: RequestInit = {
            method,
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json',
            },
            signal,
        };
        if (body !== undefined) opts.body = JSON.stringify(body);

        const res = await fetch(url, opts);
        if (!res.ok) throw new Error(`Matrix API error ${res.status}: ${await res.text()}`);
        return await res.json() as Record<string, unknown>;
    }
}
