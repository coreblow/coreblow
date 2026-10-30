import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { InstalledPluginIndex } from "./installed-plugin-index.js";
import {
  resolvePluginControlPlaneContext,
  resolvePluginControlPlaneFingerprint,
  resolvePluginDiscoveryContext,
  resolvePluginDiscoveryFingerprint,
} from "./plugin-control-plane-context.js";

function createIndex(pluginId: string): InstalledPluginIndex {
  return {
    version: 1,
    hostContractVersion: "test",
    compatRegistryVersion: "test",
    migrationVersion: 1,
    policyHash: "policy",
    generatedAtMs: 1,
    installRecords: {},
    diagnostics: [],
    plugins: [
      {
        pluginId,
        manifestPath: `/plugins/${pluginId}/coreblow.plugin.json`,
        manifestHash: `${pluginId}-manifest-hash`,
        rootDir: `/plugins/${pluginId}`,
        origin: "global",
        enabled: true,
        startup: {
          sidecar: false,
          memory: false,
          deferConfiguredChannelFullLoadUntilAfterListen: false,
          agentHarnesses: [],
        },
        compat: [],
      },
    ],
  };
}

describe("plugin control-plane context", () => {
  it("resolves env-sensitive discovery roots and load paths before fingerprinting", () => {
    const config = { plugins: { load: { paths: ["~/plugins", "/opt/shared"] } } };
    const envA = { HOME: "/home/a", COREBLOW_HOME: "/coreblow/a" } as NodeJS.ProcessEnv;
    const envB = { HOME: "/home/b", COREBLOW_HOME: "/coreblow/b" } as NodeJS.ProcessEnv;

    const firstContext = resolvePluginDiscoveryContext({ config, env: envA });
    const secondContext = resolvePluginDiscoveryContext({ config, env: envB });

    expect(firstContext.loadPaths).toEqual(["/coreblow/a/plugins", "/opt/shared"]);
    expect(secondContext.loadPaths).toEqual(["/coreblow/b/plugins", "/opt/shared"]);
    expect(resolvePluginDiscoveryFingerprint({ config, env: envA })).not.toBe(
      resolvePluginDiscoveryFingerprint({ config, env: envB }),
    );
  });

  it("includes policy, inventory, and activation in one control-plane fingerprint", () => {
    const config = { plugins: { allow: ["demo"] } };
    const base = resolvePluginControlPlaneFingerprint({
      config,
      env: { HOME: "/home/a", COREBLOW_HOME: "/coreblow/a" } as NodeJS.ProcessEnv,
      index: createIndex("demo"),
      activationFingerprint: "activation-a",
    });

    expect(
      resolvePluginControlPlaneFingerprint({
        config,
        env: { HOME: "/home/a", COREBLOW_HOME: "/coreblow/a" } as NodeJS.ProcessEnv,
        index: createIndex("other"),
        activationFingerprint: "activation-a",
      }),
    ).not.toBe(base);
    expect(
      resolvePluginControlPlaneFingerprint({
        config,
        env: { HOME: "/home/a", COREBLOW_HOME: "/coreblow/a" } as NodeJS.ProcessEnv,
        index: createIndex("demo"),
        activationFingerprint: "activation-b",
      }),
    ).not.toBe(base);
    expect(
      resolvePluginControlPlaneFingerprint({
        config: { plugins: { deny: ["demo"] } },
        env: { HOME: "/home/a", COREBLOW_HOME: "/coreblow/a" } as NodeJS.ProcessEnv,
        index: createIndex("demo"),
        activationFingerprint: "activation-a",
      }),
    ).not.toBe(base);
  });

  it("keeps the canonical context inspectable for cache diagnostics", () => {
    const context = resolvePluginControlPlaneContext({
      config: { plugins: { load: { paths: ["/opt/plugins"] } } },
      env: {
        HOME: "/home/a",
        COREBLOW_HOME: "/coreblow/a",
        COREBLOW_DISABLE_BUNDLED_PLUGINS: "1",
      } as NodeJS.ProcessEnv,
      inventoryFingerprint: "inventory",
      policyHash: "policy",
    });

    expect(context).toStrictEqual({
      discovery: {
        loadPaths: ["/opt/plugins"],
        roots: {
          stock: expect.any(String),
          global: "/coreblow/a/.coreblow/extensions",
          workspace: undefined,
        },
      },
      inventoryFingerprint: "inventory",
      policyFingerprint: "policy",
    });
  });
});
