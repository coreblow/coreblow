/**
 * CoreBlow — IRC Channel Adapter
 *
 * Production adapter for IRC protocol. Handles connection,
 * channel join/part, messaging, nick tracking, and CTCP.
 * Uses raw TCP socket — zero external dependencies.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('channel:irc');

/** IRC connection configuration */
export interface IRCConfig {
    server: string;
    port?: number;
    nick: string;
    username?: string;
    realname?: string;
    password?: string;
    channels: string[];
    ssl?: boolean;
    encoding?: string;
    autoReconnect?: boolean;
    reconnectDelayMs?: number;
    commandPrefix?: string;
}

/** IRC message from the server */
export interface IRCMessage {
    prefix?: string;
    command: string;
    params: string[];
    nick?: string;
    user?: string;
    host?: string;
    raw: string;
}

/** IRC message handler */
export type IRCMessageHandler = (msg: {
    nick: string;
    channel: string;
    text: string;
    isPrivate: boolean;
    raw: IRCMessage;
}) => void;

/**
 * CoreBlow IRC Adapter
 *
 * Implements IRC protocol via raw TCP. Handles PING/PONG keepalive,
 * nick collision recovery, and channel management.
 */
export class IRCAdapter {
    private config: IRCConfig;
    private socket: import('node:net').Socket | null = null;
    private messageHandler: IRCMessageHandler | null = null;
    private running = false;
    private buffer = '';
    private currentNick: string;
    private joinedChannels = new Set<string>();

    constructor(config: IRCConfig) {
        this.config = {
            port: config.ssl ? 6697 : 6667,
            username: config.nick,
            realname: `CoreBlow IRC Bridge`,
            autoReconnect: true,
            reconnectDelayMs: 5000,
            commandPrefix: '!',
            ...config,
        };
        this.currentNick = config.nick;
    }

    onMessage(handler: IRCMessageHandler): void {
        this.messageHandler = handler;
    }

    /** Connect to IRC server */
    async connect(): Promise<void> {
        const net = await import('node:net');
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            this.socket = socket;

            socket.setEncoding((this.config.encoding ?? 'utf-8') as BufferEncoding);

            socket.on('connect', () => {
                if (this.config.password) this.raw(`PASS ${this.config.password}`);
                this.raw(`NICK ${this.config.nick}`);
                this.raw(`USER ${this.config.username} 0 * :${this.config.realname}`);
                this.running = true;
                log.info({ server: this.config.server, nick: this.config.nick }, 'IRC connected');
                resolve();
            });

            socket.on('data', (data: string) => this.handleData(data));
            socket.on('error', (err) => {
                log.error({ err }, 'IRC socket error');
                if (!this.running) reject(err);
            });
            socket.on('close', () => {
                this.running = false;
                if (this.config.autoReconnect) {
                    setTimeout(() => this.connect().catch(() => {}), this.config.reconnectDelayMs);
                }
            });

            socket.connect(this.config.port!, this.config.server);
        });
    }

    /** Disconnect from IRC server */
    async disconnect(quitMessage = 'CoreBlow signing off'): Promise<void> {
        this.config.autoReconnect = false;
        if (this.socket) {
            this.raw(`QUIT :${quitMessage}`);
            this.socket.destroy();
            this.socket = null;
        }
        this.running = false;
        this.joinedChannels.clear();
        log.info('IRC disconnected');
    }

    /** Send a message to a channel or user */
    async sendMessage(target: string, text: string): Promise<void> {
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.trim()) {
                this.raw(`PRIVMSG ${target} :${line}`);
            }
        }
    }

    /** Send a NOTICE */
    async sendNotice(target: string, text: string): Promise<void> {
        this.raw(`NOTICE ${target} :${text}`);
    }

    /** Join a channel */
    async joinChannel(channel: string, key?: string): Promise<void> {
        this.raw(key ? `JOIN ${channel} ${key}` : `JOIN ${channel}`);
        this.joinedChannels.add(channel);
    }

    /** Part (leave) a channel */
    async partChannel(channel: string, reason?: string): Promise<void> {
        this.raw(reason ? `PART ${channel} :${reason}` : `PART ${channel}`);
        this.joinedChannels.delete(channel);
    }

    /** Change nick */
    async setNick(nick: string): Promise<void> {
        this.raw(`NICK ${nick}`);
        this.currentNick = nick;
    }

    /** Get adapter status */
    getStatus(): { running: boolean; nick: string; channels: string[]; server: string } {
        return {
            running: this.running,
            nick: this.currentNick,
            channels: [...this.joinedChannels],
            server: this.config.server,
        };
    }

    // === Private ===

    private raw(line: string): void {
        if (!this.socket || this.socket.destroyed) return;
        this.socket.write(`${line}\r\n`);
    }

    private handleData(data: string): void {
        this.buffer += data;
        const lines = this.buffer.split('\r\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
            if (!line) continue;
            const parsed = this.parseLine(line);
            if (!parsed) continue;
            this.handleMessage(parsed);
        }
    }

    private parseLine(line: string): IRCMessage | null {
        let prefix: string | undefined;
        let rest = line;

        if (rest.startsWith(':')) {
            const spaceIdx = rest.indexOf(' ');
            if (spaceIdx < 0) return null;
            prefix = rest.slice(1, spaceIdx);
            rest = rest.slice(spaceIdx + 1);
        }

        const parts = rest.split(' ');
        const command = parts.shift()?.toUpperCase() ?? '';
        const params: string[] = [];

        for (let i = 0; i < parts.length; i++) {
            if (parts[i]!.startsWith(':')) {
                params.push(parts.slice(i).join(' ').slice(1));
                break;
            }
            params.push(parts[i]!);
        }

        let nick: string | undefined;
        let user: string | undefined;
        let host: string | undefined;
        if (prefix) {
            const bangIdx = prefix.indexOf('!');
            const atIdx = prefix.indexOf('@');
            if (bangIdx > 0) {
                nick = prefix.slice(0, bangIdx);
                user = atIdx > bangIdx ? prefix.slice(bangIdx + 1, atIdx) : prefix.slice(bangIdx + 1);
                host = atIdx > 0 ? prefix.slice(atIdx + 1) : undefined;
            } else {
                nick = prefix;
            }
        }

        return { prefix, command, params, nick, user, host, raw: line };
    }

    private handleMessage(msg: IRCMessage): void {
        switch (msg.command) {
            case 'PING':
                this.raw(`PONG :${msg.params[0] ?? ''}`);
                break;

            case '001': // RPL_WELCOME
                for (const ch of this.config.channels) {
                    this.joinChannel(ch);
                }
                break;

            case '433': // ERR_NICKNAMEINUSE
                this.currentNick += '_';
                this.raw(`NICK ${this.currentNick}`);
                break;

            case 'PRIVMSG': {
                const target = msg.params[0] ?? '';
                const text = msg.params[1] ?? '';
                const isPrivate = target === this.currentNick;
                if (this.messageHandler && msg.nick) {
                    this.messageHandler({
                        nick: msg.nick,
                        channel: isPrivate ? msg.nick : target,
                        text,
                        isPrivate,
                        raw: msg,
                    });
                }
                break;
            }

            case 'NICK':
                if (msg.nick === this.currentNick) {
                    this.currentNick = msg.params[0] ?? this.currentNick;
                }
                break;
        }
    }
}
