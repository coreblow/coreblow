/**
 * src/channels/signal.ts
 * Signal channel adapter — via signal-cli JSON-RPC
 */

import type { ChannelAdapter, ChannelStatus } from './interface.js';
import { chunkMessage } from './interface.js';
import { MessageRouter } from '../gateway/router.js';
import { createChildLogger } from '../utils/logger.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';

const log = createChildLogger('channel:signal');

export class SignalChannel implements ChannelAdapter {
    name = 'signal';
    private process: ChildProcess | null = null;
    private phoneNumber: string;
    private connected = false;
    private startedAt = 0;
    private router?: MessageRouter;

    constructor(phoneNumber: string) {
        this.phoneNumber = phoneNumber;
    }

    async start(router: MessageRouter) {
        this.router = router;

        try {
            // Start signal-cli in JSON-RPC mode
            this.process = spawn('signal-cli', [
                '-u', this.phoneNumber,
                'jsonRpc',
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
            });

            if (!this.process.stdout) {
                throw new Error('Failed to start signal-cli process');
            }

            const rl = createInterface({ input: this.process.stdout });

            rl.on('line', async (line) => {
                try {
                    const data = JSON.parse(line);

                    // Handle incoming messages
                    if (data.method === 'receive') {
                        const envelope = data.params?.envelope;
                        if (!envelope?.dataMessage?.message) return;

                        const sender = envelope.source || envelope.sourceNumber;
                        const groupId = envelope.dataMessage.groupInfo?.groupId;
                        const text = envelope.dataMessage.message;

                        const inbound = {
                            channel: 'signal' as const,
                            senderId: sender,
                            senderName: envelope.sourceName || sender,
                            sessionId: MessageRouter.deriveSessionId('signal', sender, groupId),
                            groupId,
                            text,
                            timestamp: envelope.timestamp || Date.now(),
                            raw: envelope,
                        };

                        await router.routeInbound(inbound);
                    }
                } catch {
                    // Ignore non-JSON lines (signal-cli status output)
                }
            });

            this.process.stderr?.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) log.debug(msg);
            });

            this.process.on('close', (code) => {
                this.connected = false;
                log.info({ code }, 'signal-cli process exited');
            });

            // Register sender
            router.registerChannelSender('signal', async (msg) => {
                const target = msg.groupId || msg.senderId;
                const chunks = chunkMessage(msg.text, 2000);

                for (const chunk of chunks) {
                    const rpcCall = {
                        jsonrpc: '2.0',
                        method: 'send',
                        id: Date.now().toString(),
                        params: msg.groupId
                            ? { groupId: msg.groupId, message: chunk }
                            : { recipient: [target], message: chunk },
                    };

                    this.process?.stdin?.write(JSON.stringify(rpcCall) + '\n');
                }
            });

            this.connected = true;
            this.startedAt = Date.now();
            log.info({ phone: this.phoneNumber }, 'Signal channel started (signal-cli JSON-RPC)');
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to start Signal channel');
            throw err;
        }
    }

    async stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
            this.connected = false;
            log.info('Signal channel stopped');
        }
    }

    isConnected() {
        return this.connected;
    }

    getStatus(): ChannelStatus {
        return {
            name: 'signal',
            connected: this.connected,
            uptime: this.connected ? Date.now() - this.startedAt : 0,
        };
    }
}
