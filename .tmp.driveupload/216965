/**
 * Discord Voice Connection — Manages voice channel connections.
 */
export type VoiceState = 'disconnected' | 'connecting' | 'connected' | 'speaking' | 'error';

export class VoiceConnection {
    private state: VoiceState = 'disconnected';
    private guildId: string;
    private channelId: string;
    private joinedAt?: number;

    constructor(guildId: string, channelId: string) { this.guildId = guildId; this.channelId = channelId; }

    async connect(): Promise<boolean> { this.state = 'connecting'; this.state = 'connected'; this.joinedAt = Date.now(); return true; }
    async disconnect(): Promise<void> { this.state = 'disconnected'; this.joinedAt = undefined; }
    setSpeaking(speaking: boolean): void { this.state = speaking ? 'speaking' : 'connected'; }

    getState(): VoiceState { return this.state; }
    getGuildId(): string { return this.guildId; }
    getChannelId(): string { return this.channelId; }
    getUptime(): number { return this.joinedAt ? Date.now() - this.joinedAt : 0; }
    get isConnected(): boolean { return this.state === 'connected' || this.state === 'speaking'; }
}
