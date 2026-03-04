/**
 * src/channels/webchat.ts
 * Built-in WebChat channel — uses the gateway's own WebSocket
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import type { MessageRouter } from '../gateway/router.js';
import type { ProtocolHandler } from '../gateway/protocol.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:webchat');

export class WebChatChannel implements ChannelAdapter {
    name = 'webchat';
    private protocol: ProtocolHandler;
    private connected = false;
    private startedAt = 0;

    constructor(protocol: ProtocolHandler) {
        this.protocol = protocol;
    }

    async start(router: MessageRouter) {
        // Register WebChat as a sender
        router.registerChannelSender('webchat', async (msg) => {
            // Find the WebSocket client for this sender
            const client = this.protocol.getClient(msg.senderId);
            if (client) {
                this.protocol.send(client, {
                    type: 'response',
                    data: { text: msg.text },
                });
            } else {
                log.warn({ senderId: msg.senderId }, 'WebChat client not found');
            }
        });

        this.connected = true;
        this.startedAt = Date.now();
        log.info('WebChat channel active (via gateway WebSocket)');
    }

    async stop() {
        this.connected = false;
        log.info('WebChat channel stopped');
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'webchat',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
            details: {
                wsClients: this.protocol.getClientCount(),
            },
        };
    }
}
