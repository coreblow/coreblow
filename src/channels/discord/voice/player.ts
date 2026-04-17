/**
 * Discord Voice Player — Plays audio resources in voice channels.
 */
export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped';

export class VoicePlayer {
    private state: PlayerState = 'idle';
    private currentResource?: { url: string; title: string; startedAt: number };
    private volume = 1.0;

    play(url: string, title: string): boolean {
        if (this.state === 'playing') return false;
        this.currentResource = { url, title, startedAt: Date.now() };
        this.state = 'playing';
        return true;
    }

    pause(): boolean { if (this.state !== 'playing') return false; this.state = 'paused'; return true; }
    resume(): boolean { if (this.state !== 'paused') return false; this.state = 'playing'; return true; }
    stop(): void { this.state = 'stopped'; this.currentResource = undefined; }

    setVolume(vol: number): void { this.volume = Math.max(0, Math.min(2, vol)); }
    getVolume(): number { return this.volume; }
    getState(): PlayerState { return this.state; }
    getCurrent(): { url: string; title: string; durationMs: number } | null {
        if (!this.currentResource) return null;
        return { ...this.currentResource, durationMs: Date.now() - this.currentResource.startedAt };
    }
}
