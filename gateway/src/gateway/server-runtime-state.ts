export interface RuntimeStateSnapshot {
    channels: Record<string, any>;
    presenceVersion: number;
    healthVersion: number;
    lastStarted: number;
}

export class ServerRuntimeState {
    private presenceVersion = 1;
    private healthVersion = 1;
    private lastStarted = Date.now();

    bumpPresence() {
        this.presenceVersion++;
        return this.presenceVersion;
    }

    bumpHealth() {
        this.healthVersion++;
        return this.healthVersion;
    }

    getSnapshot(): RuntimeStateSnapshot {
        return {
            channels: {},
            presenceVersion: this.presenceVersion,
            healthVersion: this.healthVersion,
            lastStarted: this.lastStarted
        };
    }
}
