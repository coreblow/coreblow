/**
 * src/daemon/service-runtime.ts
 * Daemon service runtime state.
 * Ported from CoreBlow daemon/service-runtime.ts.
 */

export type GatewayServiceRuntime = {
    status?: string;
    state?: string;
    subState?: string;
    pid?: number;
    lastExitStatus?: number;
    lastExitReason?: string;
    lastRunResult?: string;
    lastRunTime?: string;
    detail?: string;
    cachedLabel?: boolean;
    missingUnit?: boolean;
};
