import type { CoreBlowConfig } from "../config/config.js";
import { buildPluginApi } from "../plugins/api-builder.js";
import type { PluginRuntime } from "../plugins/runtime/types.js";

export function createTestPluginApi(overrides: Record<string, unknown> = {}) {
  return buildPluginApi({
    id: "test",
    name: "Test",
    source: "test",
    registrationMode: "full",
    config: {} as CoreBlowConfig,
    pluginConfig: {},
    runtime: {} as PluginRuntime,
    logger: console,
    resolvePath: (input) => input,
    ...(overrides as Partial<Parameters<typeof buildPluginApi>[0]>),
  });
}
