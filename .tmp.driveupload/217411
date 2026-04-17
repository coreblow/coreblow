// @ts-nocheck
/**
 * channels/plugins/bootstrap.ts
 * CoreBlow channel plugin bootstrap — registers all built-in channel plugins
 * with the bundled channel registry on application startup.
 *
 * Usage:
 *   import { bootstrapChannelPlugins } from './channels/plugins/bootstrap.js';
 *   bootstrapChannelPlugins();
 */
import { registerDiscordChannelPlugin } from '../discord/plugin.js';
import { registerBuiltinChannelPlugins } from './channel-plugin-definitions.js';
import { listBundledChannelIds } from './bundled.js';

let bootstrapped = false;

/**
 * Register all built-in CoreBlow channel plugins.
 * Safe to call multiple times — only executes once.
 *
 * Registers:
 * - discord (from channels/discord/plugin.ts)
 * - telegram, whatsapp, slack, signal (from channel-plugin-definitions.ts)
 */
export function bootstrapChannelPlugins(): void {
    if (bootstrapped) return;
    bootstrapped = true;

    // Discord has its own dedicated plugin file
    registerDiscordChannelPlugin();

    // Other built-in channels
    registerBuiltinChannelPlugins();
}

/**
 * Get the count of registered channel plugins.
 * Useful for health checks and diagnostics.
 */
export function getRegisteredChannelCount(): number {
    return listBundledChannelIds().length;
}

/**
 * Check if plugins have been bootstrapped.
 */
export function isChannelPluginsBootstrapped(): boolean {
    return bootstrapped;
}

/**
 * Reset bootstrap state (for testing only).
 */
export function resetBootstrapForTest(): void {
    bootstrapped = false;
}
