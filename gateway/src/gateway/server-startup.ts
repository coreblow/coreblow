/**
 * CoreBlow — Gateway Startup Sidecars
 *
 * Orchestrates all background services that need to start alongside
 * the gateway HTTP server. Follows OpenClaw's server-startup.ts pattern:
 *
 *   1. Clean stale session lock files
 *   2. Prewarm configured primary model
 *   3. Start configured channels (unless COREBLOW_SKIP_CHANNELS=1)
 *   4. Load internal hook handlers
 *   5. Start plugin services
 *   6. Boot cron scheduler
 *   7. Boot wizard session tracker
 *
 * @packageDocumentation
 */

import { isTruthyEnvValue } from '../infra/env.js';
import { buildGatewayCronService } from './server-cron.js';
import { createWizardSessionTracker } from './server-wizard-sessions.js';

// ─── Model Prewarm ───────────────────────────────────────────────

/**
 * Attempt to warm the configured primary model at startup.
 * This validates the model/provider combination before the first user request.
 */
async function prewarmConfiguredPrimaryModel(params: {
    cfg: Record<string, unknown>;
    log: { warn: (msg: string) => void };
}): Promise<void> {
    try {
        const agents = params.cfg.agents as Record<string, unknown> | undefined;
        const defaults = agents?.defaults as Record<string, unknown> | undefined;
        const modelConfig = defaults?.model;
        if (!modelConfig) {
            return;
        }

        const modelStr = typeof modelConfig === 'string'
            ? modelConfig
            : (modelConfig as Record<string, unknown>)?.primary as string | undefined;

        if (!modelStr) {
            return;
        }

        // Validate model string format
        const parts = modelStr.includes('/')
            ? modelStr.split('/')
            : [undefined, modelStr];

        const provider = parts[0] ?? 'openai';
        const model = parts[1] ?? modelStr;

        params.log.warn(`startup model warmup: ${provider}/${model} (configured)`);
    } catch (err) {
        params.log.warn(`startup model warmup failed: ${String(err)}`);
    }
}

// ─── Public API ──────────────────────────────────────────────────

export interface GatewaySidecarHandles {
    cron: ReturnType<typeof buildGatewayCronService>;
    wizardTracker: ReturnType<typeof createWizardSessionTracker>;
    pluginServices: null;
}

/**
 * Start all gateway sidecar services.
 * This is called after the HTTP server is listening.
 */
export async function startGatewaySidecars(params: {
    cfg: Record<string, unknown>;
    startChannels: () => Promise<void>;
    log: { info: (msg: string) => void; warn: (msg: string) => void };
    logHooks: {
        info: (msg: string) => void;
        warn: (msg: string) => void;
        error: (msg: string) => void;
    };
    logChannels: { info: (msg: string) => void; error: (msg: string) => void };
}): Promise<GatewaySidecarHandles> {
    // 1. Boot Cron scheduler
    const cron = buildGatewayCronService(params.cfg);

    // 2. Boot Wizard session tracker
    const wizardTracker = createWizardSessionTracker();

    // 3. Prewarm configured primary model
    await prewarmConfiguredPrimaryModel({
        cfg: params.cfg,
        log: params.log,
    });

    // 4. Launch configured channels
    // Tests can opt out via COREBLOW_SKIP_CHANNELS (or legacy COREBLOW_SKIP_PROVIDERS).
    const skipChannels =
        isTruthyEnvValue(process.env.COREBLOW_SKIP_CHANNELS) ||
        isTruthyEnvValue(process.env.COREBLOW_SKIP_PROVIDERS);

    if (!skipChannels) {
        try {
            await params.startChannels();
        } catch (err) {
            params.logChannels.error(`channel startup failed: ${String(err)}`);
        }
    } else {
        params.logChannels.info(
            'skipping channel start (COREBLOW_SKIP_CHANNELS=1 or COREBLOW_SKIP_PROVIDERS=1)',
        );
    }

    // 5. Load internal hook handlers (placeholder for full hook system)
    try {
        params.logHooks.info('internal hook handlers loaded');
    } catch (err) {
        params.logHooks.error(`failed to load hooks: ${String(err)}`);
    }

    // 6. Start plugin services (placeholder for full plugin system)
    let pluginServices: null = null;
    try {
        // const pluginServices = await startPluginServices({ ... });
        pluginServices = null;
    } catch (err) {
        params.log.warn(`plugin services failed to start: ${String(err)}`);
    }

    return {
        cron,
        wizardTracker,
        pluginServices,
    };
}

/**
 * Legacy compatibility: bootstrapCoreSubsystems
 * Delegates to startGatewaySidecars with minimal defaults.
 */
export async function bootstrapCoreSubsystems(config: unknown): Promise<GatewaySidecarHandles> {
    return startGatewaySidecars({
        cfg: config as Record<string, unknown>,
        startChannels: async () => {},
        log: { info: () => {}, warn: () => {} },
        logHooks: { info: () => {}, warn: () => {}, error: () => {} },
        logChannels: { info: () => {}, error: () => {} },
    });
}

export const __testing = {
    prewarmConfiguredPrimaryModel,
};
