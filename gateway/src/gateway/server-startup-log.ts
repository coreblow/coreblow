/**
 * CoreBlow — Gateway Startup Log
 *
 * Resolves the configured model ref from coreblow.json and
 * provides it for banner display. Direct port of OpenClaw's
 * `gateway/server-startup-log.ts` pattern.
 *
 * OpenClaw chain:
 *   loadConfig() → resolveConfiguredModelRef(cfg) → logGatewayStartup()
 *
 * CoreBlow chain:
 *   loadConfig() → resolveStartupModelRef(cfg) → CLIBanner.generate()
 *
 * @packageDocumentation
 */

import { DEFAULT_MODEL_ID, DEFAULT_PROVIDER } from '../agents/defaults.js';
import {
    resolveConfiguredModelRef,
    type CoreBlowConfig as ModelSelectionConfig,
} from '../agents/model-selection.js';
import type { CoreBlowConfig } from '../config/config.js';
import type { GatewayLogger } from "./gateway-types.js";

/**
 * Resolve the provider/model to display at gateway startup.
 *
 * Reads from config's `agents.defaults.model` field, falling back
 * to DEFAULT_PROVIDER/DEFAULT_MODEL_ID when unconfigured.
 * Mirrors OpenClaw's `logGatewayStartup` → `resolveConfiguredModelRef`.
 */
export function resolveStartupModelRef(cfg: CoreBlowConfig): {
    provider: string;
    model: string;
} {
    // CoreBlow has two CoreBlowConfig types — one in config/config.ts (loaded from disk)
    // and one in model-selection.ts (used by resolveConfiguredModelRef). They are
    // structurally compatible at runtime. Cast directly to avoid index signature mismatch.
    const modelCfg = cfg as unknown as ModelSelectionConfig;

    return resolveConfiguredModelRef({
        cfg: modelCfg,
        defaultProvider: DEFAULT_PROVIDER,
        defaultModel: DEFAULT_MODEL_ID,
    });
}

/**
 * Log gateway startup diagnostics to the structured logger.
 * Preserved from prior implementation.
 */
export function logGatewayStartupDiagnostics(log: GatewayLogger, cfg: CoreBlowConfig, port: number) {
    log.info(`====================================================`);
    log.info(`CoreBlow Gateway Starting...`);
    log.info(`Port: ${port}`);
    log.info(`Auth Mode: ${cfg?.gateway?.auth?.token ? "token" : "none"}`);

    // Log Node Version
    log.info(`Node.js Version: ${process.version}`);

    // Log process memory limitation config if present
    const maxOldSpace = process.execArgv.find(arg => arg.startsWith('--max-old-space-size='));
    log.info(`V8 Memory Limit: ${maxOldSpace ? maxOldSpace.split('=')[1] + 'MB' : 'Default'}`);
    log.info(`====================================================`);
}

