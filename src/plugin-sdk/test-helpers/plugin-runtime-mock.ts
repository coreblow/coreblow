/**
 * Plugin runtime mock helper.
 *
 * CoreBlow PluginRuntimeChannel contains massive per-channel surfaces (discord,
 * slack, telegram, etc.) typed as `typeof import(...)`. Fully mocking this
 * surface requires hundreds of stubs.
 *
 * This stub closes the API gap to prevent test breakage when CoreBlow
 * tests use `createPluginRuntimeMock` but omits the full deep implementation
 * since it represents a major architectural difference.
 */
import type { PluginRuntime } from "../testing.js";

// Minimal facade to avoid test compiler errors.
export function createPluginRuntimeMock(
  overrides: Record<string, unknown> = {}
): PluginRuntime {
  return overrides as unknown as PluginRuntime;
}

export function createPluginRuntimeMediaMock(
  overrides: Record<string, unknown> = {}
): PluginRuntime["channel"]["media"] {
  return overrides as unknown as PluginRuntime["channel"]["media"];
}
