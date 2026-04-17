export type ChannelRuntimeSnapshot = {
    channels: Record<string, any>;
    channelAccounts: Record<string, any>;
};

export interface ChannelManager {
    getRuntimeSnapshot: () => ChannelRuntimeSnapshot;
    startChannels: () => Promise<void>;
    startChannel: (channelId: string, accountId?: string) => Promise<void>;
    stopChannel: (channelId: string, accountId?: string) => Promise<void>;
    markChannelLoggedOut: (channelId: string, cleared: boolean, accountId?: string) => void;
}

export function createChannelManager(opts: {
    log: unknown;
    channelLogs: Record<string, any>;
}): ChannelManager {
    const runtimes = new Map<string, any>();

    const getRuntimeSnapshot = (): ChannelRuntimeSnapshot => {
        return {
            channels: Object.fromEntries(runtimes),
            channelAccounts: {} // simplified for CoreBlow
        };
    };

    const startChannel = async (channelId: string, accountId?: string) => {
        const id = accountId ? `${channelId}:${accountId}` : channelId;
        (opts.log as any).info(`Starting channel: ${id}`);
        runtimes.set(id, { running: true, startedAt: Date.now() });
    };

    const startChannels = async () => {
        // Automatically start all registered channels
        (opts.log as any).info("Starting all configured channels...");
    };

    const stopChannel = async (channelId: string, accountId?: string) => {
        const id = accountId ? `${channelId}:${accountId}` : channelId;
        (opts.log as any).info(`Stopping channel: ${id}`);
        runtimes.delete(id);
    };

    const markChannelLoggedOut = (channelId: string, cleared: boolean, accountId?: string) => {
        const id = accountId ? `${channelId}:${accountId}` : channelId;
        if (runtimes.has(id)) {
            runtimes.get(id).loggedOut = cleared;
        }
    };

    return {
        getRuntimeSnapshot,
        startChannels,
        startChannel,
        stopChannel,
        markChannelLoggedOut
    };
}
