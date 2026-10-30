import fs from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";

// Narrow public testing surface for plugin authors.
// Keep this list additive and limited to helpers we are willing to support.
/** @deprecated Broad compatibility barrel. Prefer focused test subpaths. */

export {
  createAckReactionHandle,
  removeAckReactionAfterReply,
  removeAckReactionHandleAfterReply,
  shouldAckReaction,
} from "../channels/ack-reactions.js";
export type { ChannelAccountSnapshot } from "../channels/plugins/types.public.js";
export type { ChannelGatewayContext } from "../channels/plugins/types.adapters.js";
export type { CoreBlowConfig } from "../config/config.js";
export {
  isAtLeast,
  parseSemver,
} from "../infra/runtime-guard.js";
export {
  deliverOutboundPayloads,
} from "../infra/outbound/deliver.js";
export {
  createEmptyPluginRegistry,
  createPluginRegistry,
  type PluginRecord,
} from "../plugins/registry.js";
export {
  providerContractLoadError,
  pluginRegistrationContractRegistry,
  resolveProviderContractProvidersForPluginIds,
} from "../plugins/contracts/registry.js";
export { loadPluginManifestRegistry } from "../plugins/manifest-registry.js";
export { parseMinHostVersionRequirement } from "../plugins/min-host-version.js";
export {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../plugins/hook-runner-global.js";
export { addTestHook } from "../plugins/hooks.test-helpers.js";
export { createPluginRecord } from "../plugins/status.test-helpers.js";
export {
  getActivePluginRegistry,
  releasePinnedPluginChannelRegistry,
  resetPluginRuntimeStateForTest,
  setActivePluginRegistry,
} from "../plugins/runtime.js";
export {
  listImportedBundledPluginFacadeIds,
  resetFacadeRuntimeStateForTest,
} from "./facade-runtime.js";
export {
  capturePluginRegistration,
  createCapturedPluginRegistration,
} from "../plugins/captured-registration.js";
export { runProviderCatalog } from "../plugins/provider-discovery.js";
export {
  buildProviderPluginMethodChoice,
  resolveProviderModelPickerEntries,
  resolveProviderWizardOptions,
  setProviderWizardProvidersResolverForTest,
} from "../plugins/provider-wizard.js";
export { resolveProviderPluginChoice } from "../plugins/provider-auth-choice.runtime.js";
export type { PluginRuntime } from "../plugins/runtime/types.js";
export type { PluginHookRegistration } from "../plugins/hook-types.js";
export type { RuntimeEnv } from "../runtime.js";
export type { MockFn } from "../test-utils/vitest-mock-fn.js";
export {
  createOutboundTestPlugin,
  createTestRegistry,
} from "../test-utils/channel-plugins.js";
export {
  registerProviderPlugins,
  requireRegisteredProvider,
} from "../test-utils/plugin-registration.js";
export {
  registerProviderPlugin,
  registerSingleProviderPlugin,
} from "./plugin-test-runtime.js";
export { createTempHomeEnv, type TempHomeEnv } from "../test-utils/temp-home.js";
export {
  createRuntimeEnv,
} from "../test-utils/plugin-runtime-env.js";
export {
  createQueuedWizardPrompter,
  createTestWizardPrompter,
  type WizardPrompter,
} from "../test-utils/plugin-setup-wizard.js";
export { createMockPluginRegistry } from "../plugins/hooks.test-helpers.js";
export { buildPluginApi } from "../plugins/api-builder.js";
export {
  expectAugmentedCodexCatalog,
  expectedAugmentedOpenaiCodexCatalogEntries,
  expectCodexMissingAuthHint,
} from "../plugins/provider-runtime.test-support.js";

/** Create a tiny Windows `.cmd` shim fixture for plugin tests that spawn CLIs. */
export async function createWindowsCmdShimFixture(params: {
  shimPath: string;
  scriptPath: string;
  shimLine: string;
}): Promise<void> {
  await fs.mkdir(path.dirname(params.scriptPath), { recursive: true });
  await fs.mkdir(path.dirname(params.shimPath), { recursive: true });
  await fs.writeFile(params.scriptPath, "module.exports = {};\n", "utf8");
  await fs.writeFile(params.shimPath, `@echo off\r\n${params.shimLine}\r\n`, "utf8");
}

type ResolveTargetMode = "explicit" | "implicit" | "heartbeat";

type ResolveTargetResult = {
  ok: boolean;
  to?: string;
  error?: unknown;
};

type ResolveTargetFn = (params: {
  to?: string;
  mode: ResolveTargetMode;
  allowFrom: string[];
}) => ResolveTargetResult;

/** Install a shared test matrix for target-resolution error handling. */
export function installCommonResolveTargetErrorCases(params: {
  resolveTarget: ResolveTargetFn;
  implicitAllowFrom: string[];
}) {
  const { resolveTarget, implicitAllowFrom } = params;

  it("should error on normalization failure with allowlist (implicit mode)", () => {
    const result = resolveTarget({
      to: "invalid-target",
      mode: "implicit",
      allowFrom: implicitAllowFrom,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error when no target provided with allowlist", () => {
    const result = resolveTarget({
      to: undefined,
      mode: "implicit",
      allowFrom: implicitAllowFrom,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should error when no target and no allowlist", () => {
    const result = resolveTarget({
      to: undefined,
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("should handle whitespace-only target", () => {
    const result = resolveTarget({
      to: "   ",
      mode: "explicit",
      allowFrom: [],
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
}
