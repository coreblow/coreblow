import fs from "node:fs";
import type { CoreBlowConfig, GatewayLogger } from "./gateway-types.js";

export type GatewayReloadPlan = {
    restartGateway: boolean;
    restartReasons: string[];
};

export function diffConfigPaths(prev: Record<string, unknown>, next: Record<string, unknown>, prefix = ""): string[] {
    if (prev === next) return [];
    if (typeof prev === "object" && prev !== null && typeof next === "object" && next !== null) {
        const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
        const paths: string[] = [];
        for (const key of keys) {
            if (prev[key] === undefined && next[key] === undefined) continue;
            const childPrefix = prefix ? `${prefix}.${key}` : key;
            const childPaths = diffConfigPaths(
                prev[key] as Record<string, unknown> ?? {},
                next[key] as Record<string, unknown> ?? {},
                childPrefix,
            );
            if (childPaths.length > 0) paths.push(...childPaths);
        }
        return paths;
    }
    if (Array.isArray(prev) && Array.isArray(next)) {
        if (JSON.stringify(prev) === JSON.stringify(next)) return [];
    }
    return [prefix || "<root>"];
}

export function buildGatewayReloadPlan(changedPaths: string[]): GatewayReloadPlan {
    const restartReasons: string[] = [];
    for (const p of changedPaths) {
        if (p.startsWith("gateway.port")) restartReasons.push(p);
        if (p.startsWith("gateway.tls")) restartReasons.push(p);
        if (p.startsWith("gateway.auth")) restartReasons.push(p);
    }
    return {
        restartGateway: restartReasons.length > 0,
        restartReasons,
    };
}

export function startGatewayConfigReloader(opts: {
    initialConfig: Record<string, unknown>;
    readSnapshot: () => Promise<Record<string, unknown> | null>;
    onHotReload: (plan: GatewayReloadPlan, nextConfig: Record<string, unknown>) => Promise<void>;
    onRestart: (plan: GatewayReloadPlan, nextConfig: Record<string, unknown>) => void | Promise<void>;
    log: GatewayLogger;
    watchPath: string;
}) {
    let currentConfig = opts.initialConfig;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const runReload = async () => {
        if (stopped) return;
        try {
            const nextConfig = await opts.readSnapshot();
            if (!nextConfig) return; // snapshot failed

            const changedPaths = diffConfigPaths(
                currentConfig as Record<string, unknown>,
                nextConfig as Record<string, unknown>,
            );
            if (changedPaths.length === 0) return;

            currentConfig = nextConfig;
            opts.log.info(`Config changed: ${changedPaths.join(", ")}`);

            const plan = buildGatewayReloadPlan(changedPaths);
            if (plan.restartGateway) {
                opts.log.warn(`Triggering restart across reasons: ${plan.restartReasons.join(", ")}`);
                await opts.onRestart(plan, nextConfig);
            } else {
                await opts.onHotReload(plan, nextConfig);
            }
        } catch (err) {
            opts.log.error(`Config reload failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const schedule = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void runReload(), 300);
    };

    let watcher: fs.FSWatcher | null = null;
    try {
        watcher = fs.watch(opts.watchPath, (eventType, filename) => {
            if (eventType === "change" || eventType === "rename") {
                schedule();
            }
        });
    } catch (err) {
        opts.log.warn(`Could not start config watcher: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
        stop: async () => {
            stopped = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            if (watcher) watcher.close();
        }
    };
}
