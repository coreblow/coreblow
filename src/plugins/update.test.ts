import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";

const installPluginFromNpmSpecMock = vi.fn();
const installPluginFromMarketplaceMock = vi.fn();
const installPluginFromCoreHubMock = vi.fn();
const verifyCoreHubInstalledTrustRecordMock = vi.fn();
const resolveBundledPluginSourcesMock = vi.fn();

vi.mock("./install.js", () => ({
  installPluginFromNpmSpec: (...args: unknown[]) => installPluginFromNpmSpecMock(...args),
  resolvePluginInstallDir: (pluginId: string) => `/tmp/${pluginId}`,
  PLUGIN_INSTALL_ERROR_CODE: {
    NPM_PACKAGE_NOT_FOUND: "npm_package_not_found",
  },
}));

vi.mock("./marketplace.js", () => ({
  installPluginFromMarketplace: (...args: unknown[]) => installPluginFromMarketplaceMock(...args),
}));

vi.mock("./coreblow-hub.js", () => ({
  installPluginFromCoreHub: (...args: unknown[]) => installPluginFromCoreHubMock(...args),
  verifyCoreHubInstalledTrustRecord: (...args: unknown[]) =>
    verifyCoreHubInstalledTrustRecordMock(...args),
}));

vi.mock("./bundled-sources.js", () => ({
  resolveBundledPluginSources: (...args: unknown[]) => resolveBundledPluginSourcesMock(...args),
}));

const { syncPluginsForUpdateChannel, updateNpmInstalledPlugins } = await import("./update.js");

function createSuccessfulNpmUpdateResult(params?: {
  pluginId?: string;
  targetDir?: string;
  version?: string;
  npmResolution?: {
    name: string;
    version: string;
    resolvedSpec: string;
  };
}) {
  return {
    ok: true,
    pluginId: params?.pluginId ?? "opik-coreblow",
    targetDir: params?.targetDir ?? "/tmp/opik-coreblow",
    version: params?.version ?? "0.2.6",
    extensions: ["index.ts"],
    ...(params?.npmResolution ? { npmResolution: params.npmResolution } : {}),
  };
}

function createNpmInstallConfig(params: {
  pluginId: string;
  spec: string;
  installPath: string;
  integrity?: string;
  resolvedName?: string;
  resolvedSpec?: string;
}) {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "npm" as const,
          spec: params.spec,
          installPath: params.installPath,
          ...(params.integrity ? { integrity: params.integrity } : {}),
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
        },
      },
    },
  };
}

function createMarketplaceInstallConfig(params: {
  pluginId: string;
  installPath: string;
  marketplaceSource: string;
  marketplacePlugin: string;
  marketplaceName?: string;
}): CoreBlowConfig {
  return {
    plugins: {
      installs: {
        [params.pluginId]: {
          source: "marketplace" as const,
          installPath: params.installPath,
          marketplaceSource: params.marketplaceSource,
          marketplacePlugin: params.marketplacePlugin,
          ...(params.marketplaceName ? { marketplaceName: params.marketplaceName } : {}),
        },
      },
    },
  };
}

function createCoreHubInstallConfig(params: {
  pluginId: string;
  installPath: string;
  corehubUrl: string;
  corehubPackage: string;
  corehubFamily: "bundle-plugin" | "code-plugin";
  corehubChannel: "community" | "official" | "private";
  version?: string;
  artifactSha256?: string;
  artifactManifestSha256?: string;
  artifactStorageKey?: string;
  verifiedAt?: string;
  corehubPolicy?: NonNullable<CoreBlowConfig["plugins"]>["corehub"];
}): CoreBlowConfig {
  return {
    plugins: {
      ...(params.corehubPolicy ? { corehub: params.corehubPolicy } : {}),
      installs: {
        [params.pluginId]: {
          source: "corehub" as const,
          spec: `corehub:${params.corehubPackage}`,
          installPath: params.installPath,
          corehubUrl: params.corehubUrl,
          corehubPackage: params.corehubPackage,
          corehubFamily: params.corehubFamily,
          corehubChannel: params.corehubChannel,
          ...(params.version ? { version: params.version } : {}),
          ...(params.artifactSha256 ? { artifactSha256: params.artifactSha256 } : {}),
          ...(params.artifactManifestSha256
            ? { artifactManifestSha256: params.artifactManifestSha256 }
            : {}),
          ...(params.artifactStorageKey ? { artifactStorageKey: params.artifactStorageKey } : {}),
          ...(params.verifiedAt ? { verifiedAt: params.verifiedAt } : {}),
        },
      },
    },
  };
}

function createBundledPathInstallConfig(params: {
  loadPaths: string[];
  installPath: string;
  sourcePath?: string;
  spec?: string;
}): CoreBlowConfig {
  return {
    plugins: {
      load: { paths: params.loadPaths },
      installs: {
        feishu: {
          source: "path",
          sourcePath: params.sourcePath ?? "/app/extensions/feishu",
          installPath: params.installPath,
          ...(params.spec ? { spec: params.spec } : {}),
        },
      },
    },
  };
}

function createCodexAppServerInstallConfig(params: {
  spec: string;
  resolvedName?: string;
  resolvedSpec?: string;
}) {
  return {
    plugins: {
      installs: {
        "coreblow-codex-app-server": {
          source: "npm" as const,
          spec: params.spec,
          installPath: "/tmp/coreblow-codex-app-server",
          ...(params.resolvedName ? { resolvedName: params.resolvedName } : {}),
          ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
        },
      },
    },
  };
}

function expectNpmUpdateCall(params: {
  spec: string;
  expectedIntegrity?: string;
  expectedPluginId?: string;
}) {
  expect(installPluginFromNpmSpecMock).toHaveBeenCalledWith(
    expect.objectContaining({
      spec: params.spec,
      expectedIntegrity: params.expectedIntegrity,
      ...(params.expectedPluginId ? { expectedPluginId: params.expectedPluginId } : {}),
    }),
  );
}

function createBundledSource(params?: { pluginId?: string; localPath?: string; npmSpec?: string }) {
  const pluginId = params?.pluginId ?? "feishu";
  return {
    pluginId,
    localPath: params?.localPath ?? `/app/extensions/${pluginId}`,
    npmSpec: params?.npmSpec ?? `@coreblow/${pluginId}`,
  };
}

function mockBundledSources(...sources: ReturnType<typeof createBundledSource>[]) {
  resolveBundledPluginSourcesMock.mockReturnValue(
    new Map(sources.map((source) => [source.pluginId, source])),
  );
}

function expectBundledPathInstall(params: {
  install: Record<string, unknown> | undefined;
  sourcePath: string;
  installPath: string;
  spec?: string;
}) {
  expect(params.install).toMatchObject({
    source: "path",
    sourcePath: params.sourcePath,
    installPath: params.installPath,
    ...(params.spec ? { spec: params.spec } : {}),
  });
}

function expectCodexAppServerInstallState(params: {
  result: Awaited<ReturnType<typeof updateNpmInstalledPlugins>>;
  spec: string;
  version: string;
  resolvedSpec?: string;
}) {
  expect(params.result.config.plugins?.installs?.["coreblow-codex-app-server"]).toMatchObject({
    source: "npm",
    spec: params.spec,
    installPath: "/tmp/coreblow-codex-app-server",
    version: params.version,
    ...(params.resolvedSpec ? { resolvedSpec: params.resolvedSpec } : {}),
  });
}

describe("updateNpmInstalledPlugins", () => {
  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    installPluginFromMarketplaceMock.mockReset();
    installPluginFromCoreHubMock.mockReset();
    verifyCoreHubInstalledTrustRecordMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
    verifyCoreHubInstalledTrustRecordMock.mockResolvedValue({ ok: true, warnings: [] });
  });

  it.each([
    {
      name: "skips integrity drift checks for unpinned npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-coreblow",
        spec: "@opik/opik-coreblow",
        integrity: "sha512-old",
        installPath: "/tmp/opik-coreblow",
      }),
      pluginIds: ["opik-coreblow"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-coreblow",
        expectedIntegrity: undefined,
      },
    },
    {
      name: "keeps integrity drift checks for exact-version npm specs during dry-run updates",
      config: createNpmInstallConfig({
        pluginId: "opik-coreblow",
        spec: "@opik/opik-coreblow@0.2.5",
        integrity: "sha512-old",
        installPath: "/tmp/opik-coreblow",
      }),
      pluginIds: ["opik-coreblow"],
      dryRun: true,
      expectedCall: {
        spec: "@opik/opik-coreblow@0.2.5",
        expectedIntegrity: "sha512-old",
      },
    },
    {
      name: "skips recorded integrity checks when an explicit npm version override changes the spec",
      config: createNpmInstallConfig({
        pluginId: "coreblow-codex-app-server",
        spec: "coreblow-codex-app-server@0.2.0-beta.3",
        integrity: "sha512-old",
        installPath: "/tmp/coreblow-codex-app-server",
      }),
      pluginIds: ["coreblow-codex-app-server"],
      specOverrides: {
        "coreblow-codex-app-server": "coreblow-codex-app-server@0.2.0-beta.4",
      },
      installerResult: createSuccessfulNpmUpdateResult({
        pluginId: "coreblow-codex-app-server",
        targetDir: "/tmp/coreblow-codex-app-server",
        version: "0.2.0-beta.4",
      }),
      expectedCall: {
        spec: "coreblow-codex-app-server@0.2.0-beta.4",
        expectedIntegrity: undefined,
      },
    },
  ] as const)(
    "$name",
    async ({ config, pluginIds, dryRun, specOverrides, installerResult, expectedCall }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(
        installerResult ?? createSuccessfulNpmUpdateResult(),
      );

      await updateNpmInstalledPlugins({
        config,
        pluginIds: [...pluginIds],
        ...(dryRun ? { dryRun: true } : {}),
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall(expectedCall);
    },
  );

  it.each([
    {
      name: "formats package-not-found updates with a stable message",
      installerResult: {
        ok: false,
        code: "npm_package_not_found",
        error: "Package not found on npm: @coreblow/missing.",
      },
      config: createNpmInstallConfig({
        pluginId: "missing",
        spec: "@coreblow/missing",
        installPath: "/tmp/missing",
      }),
      pluginId: "missing",
      expectedMessage: "Failed to check missing: npm package not found for @coreblow/missing.",
    },
    {
      name: "falls back to raw installer error for unknown error codes",
      installerResult: {
        ok: false,
        code: "invalid_npm_spec",
        error: "unsupported npm spec: github:evil/evil",
      },
      config: createNpmInstallConfig({
        pluginId: "bad",
        spec: "github:evil/evil",
        installPath: "/tmp/bad",
      }),
      pluginId: "bad",
      expectedMessage: "Failed to check bad: unsupported npm spec: github:evil/evil",
    },
  ] as const)("$name", async ({ installerResult, config, pluginId, expectedMessage }) => {
    installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: [pluginId],
      dryRun: true,
    });

    expect(result.outcomes).toEqual([
      {
        pluginId,
        status: "error",
        message: expectedMessage,
      },
    ]);
  });

  it.each([
    {
      name: "reuses a recorded npm dist-tag spec for id-based updates",
      installerResult: {
        ok: true,
        pluginId: "coreblow-codex-app-server",
        targetDir: "/tmp/coreblow-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
      },
      config: createCodexAppServerInstallConfig({
        spec: "coreblow-codex-app-server@beta",
        resolvedName: "coreblow-codex-app-server",
        resolvedSpec: "coreblow-codex-app-server@0.2.0-beta.3",
      }),
      expectedSpec: "coreblow-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
    },
    {
      name: "uses and persists an explicit npm spec override during updates",
      installerResult: {
        ok: true,
        pluginId: "coreblow-codex-app-server",
        targetDir: "/tmp/coreblow-codex-app-server",
        version: "0.2.0-beta.4",
        extensions: ["index.ts"],
        npmResolution: {
          name: "coreblow-codex-app-server",
          version: "0.2.0-beta.4",
          resolvedSpec: "coreblow-codex-app-server@0.2.0-beta.4",
        },
      },
      config: createCodexAppServerInstallConfig({
        spec: "coreblow-codex-app-server",
      }),
      specOverrides: {
        "coreblow-codex-app-server": "coreblow-codex-app-server@beta",
      },
      expectedSpec: "coreblow-codex-app-server@beta",
      expectedVersion: "0.2.0-beta.4",
      expectedResolvedSpec: "coreblow-codex-app-server@0.2.0-beta.4",
    },
  ] as const)(
    "$name",
    async ({
      installerResult,
      config,
      specOverrides,
      expectedSpec,
      expectedVersion,
      expectedResolvedSpec,
    }) => {
      installPluginFromNpmSpecMock.mockResolvedValue(installerResult);

      const result = await updateNpmInstalledPlugins({
        config,
        pluginIds: ["coreblow-codex-app-server"],
        ...(specOverrides ? { specOverrides } : {}),
      });

      expectNpmUpdateCall({
        spec: expectedSpec,
        expectedPluginId: "coreblow-codex-app-server",
      });
      expectCodexAppServerInstallState({
        result,
        spec: expectedSpec,
        version: expectedVersion,
        ...(expectedResolvedSpec ? { resolvedSpec: expectedResolvedSpec } : {}),
      });
    },
  );

  it("updates CoreHub-installed plugins via recorded package metadata", async () => {
    installPluginFromCoreHubMock.mockResolvedValue({
      ok: true,
      pluginId: "demo",
      targetDir: "/tmp/demo",
      version: "1.2.4",
      corehub: {
        source: "corehub",
        corehubUrl: "https://corehub.ai",
        corehubPackage: "demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
        integrity: "sha256-next",
        artifactSha256: "next-sha256",
        artifactSize: 736,
        artifactManifestVerified: true,
        artifactManifestSha256: "next-manifest-sha256",
        artifactStorageKey: "plugins/demo/1.2.4/plugin.tgz",
        publisherHandle: "coreblow",
        resolvedAt: "2026-03-22T00:00:00.000Z",
        verifiedAt: "2026-03-22T00:00:00.000Z",
      },
    });

    const result = await updateNpmInstalledPlugins({
      config: createCoreHubInstallConfig({
        pluginId: "demo",
        installPath: "/tmp/demo",
        corehubUrl: "https://corehub.ai",
        corehubPackage: "demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
        version: "1.2.3",
        artifactSha256: "old-sha256",
        artifactManifestSha256: "old-manifest-sha256",
        artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
        verifiedAt: "2026-03-21T00:00:00.000Z",
        corehubPolicy: {
          allowCommunity: false,
          requiredVerificationTiers: ["source-linked"],
        },
      }),
      pluginIds: ["demo"],
    });

    expect(installPluginFromCoreHubMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "corehub:demo",
        baseUrl: "https://corehub.ai",
        expectedPluginId: "demo",
        mode: "update",
        policy: {
          allowCommunity: false,
          requiredVerificationTiers: ["source-linked"],
        },
      }),
    );
    expect(verifyCoreHubInstalledTrustRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          corehubPackage: "demo",
          corehubUrl: "https://corehub.ai",
        }),
      }),
    );
    expect(result.config.plugins?.installs?.demo).toMatchObject({
      source: "corehub",
      spec: "corehub:demo",
      installPath: "/tmp/demo",
      version: "1.2.4",
      corehubPackage: "demo",
      corehubFamily: "code-plugin",
      corehubChannel: "official",
      integrity: "sha256-next",
      artifactSha256: "next-sha256",
      artifactManifestVerified: true,
      artifactManifestSha256: "next-manifest-sha256",
      artifactStorageKey: "plugins/demo/1.2.4/plugin.tgz",
      publisherHandle: "coreblow",
      previousVersion: "1.2.3",
      previousArtifactSha256: "old-sha256",
      previousArtifactManifestSha256: "old-manifest-sha256",
      previousArtifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
      previousVerifiedAt: "2026-03-21T00:00:00.000Z",
      updatedAt: expect.any(String),
    });
  });

  it("keeps CoreHub install metadata unchanged when update installation fails", async () => {
    installPluginFromCoreHubMock.mockResolvedValue({
      ok: false,
      error: "post-copy validation failed: CoreHub plugin archive extension entry not found",
      code: "missing_extension_entry",
    });
    const config = createCoreHubInstallConfig({
      pluginId: "demo",
      installPath: "/tmp/demo",
      corehubUrl: "https://corehub.ai",
      corehubPackage: "demo",
      corehubFamily: "code-plugin",
      corehubChannel: "official",
      version: "1.2.3",
      artifactSha256: "old-sha256",
      artifactManifestSha256: "old-manifest-sha256",
      artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
      verifiedAt: "2026-03-21T00:00:00.000Z",
    });

    const result = await updateNpmInstalledPlugins({
      config,
      pluginIds: ["demo"],
    });

    expect(result.changed).toBe(false);
    expect(result.config).toBe(config);
    expect(result.config.plugins?.installs?.demo).toMatchObject({
      version: "1.2.3",
      artifactSha256: "old-sha256",
      artifactManifestSha256: "old-manifest-sha256",
      artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
      verifiedAt: "2026-03-21T00:00:00.000Z",
    });
    expect(result.config.plugins?.installs?.demo?.previousVersion).toBeUndefined();
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "error",
        message:
          "Failed to update demo: post-copy validation failed: CoreHub plugin archive extension entry not found (CoreHub corehub:demo).",
      },
    ]);
  });

  it("blocks CoreHub updates when the recorded trust proof no longer verifies", async () => {
    verifyCoreHubInstalledTrustRecordMock.mockResolvedValueOnce({
      ok: false,
      code: "trust_drift",
      error: "CoreHub trust proof changed for demo@1.2.3: artifactSha256 changed.",
    });

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          installs: {
            demo: {
              source: "corehub",
              spec: "corehub:demo",
              installPath: "/tmp/demo",
              version: "1.2.3",
              corehubUrl: "https://corehub.ai",
              corehubPackage: "demo",
              corehubFamily: "code-plugin",
              corehubChannel: "official",
              artifactSha256: "old-sha256",
              artifactSize: 736,
              artifactManifestVerified: true,
              artifactManifestSha256: "old-manifest-sha256",
              artifactStorageKey: "plugins/demo/1.2.3/plugin.tgz",
              publisherHandle: "coreblow",
            },
          },
        },
      },
      pluginIds: ["demo"],
    });

    expect(installPluginFromCoreHubMock).not.toHaveBeenCalled();
    expect(result.changed).toBe(false);
    expect(result.outcomes).toEqual([
      {
        pluginId: "demo",
        status: "error",
        message:
          "Failed to verify demo before update: CoreHub trust proof changed for demo@1.2.3: artifactSha256 changed.",
      },
    ]);
  });

  it("migrates legacy unscoped install keys when a scoped npm package updates", async () => {
    installPluginFromNpmSpecMock.mockResolvedValue({
      ok: true,
      pluginId: "@coreblow/voice-call",
      targetDir: "/tmp/coreblow-voice-call",
      version: "0.0.2",
      extensions: ["index.ts"],
    });

    const result = await updateNpmInstalledPlugins({
      config: {
        plugins: {
          allow: ["voice-call"],
          deny: ["voice-call"],
          slots: { memory: "voice-call" },
          entries: {
            "voice-call": {
              enabled: false,
              hooks: { allowPromptInjection: false },
            },
          },
          installs: {
            "voice-call": {
              source: "npm",
              spec: "@coreblow/voice-call",
              installPath: "/tmp/voice-call",
            },
          },
        },
      },
      pluginIds: ["voice-call"],
    });

    expect(installPluginFromNpmSpecMock).toHaveBeenCalledWith(
      expect.objectContaining({
        spec: "@coreblow/voice-call",
        expectedPluginId: "voice-call",
      }),
    );
    expect(result.config.plugins?.allow).toEqual(["@coreblow/voice-call"]);
    expect(result.config.plugins?.deny).toEqual(["@coreblow/voice-call"]);
    expect(result.config.plugins?.slots?.memory).toBe("@coreblow/voice-call");
    expect(result.config.plugins?.entries?.["@coreblow/voice-call"]).toEqual({
      enabled: false,
      hooks: { allowPromptInjection: false },
    });
    expect(result.config.plugins?.entries?.["voice-call"]).toBeUndefined();
    expect(result.config.plugins?.installs?.["@coreblow/voice-call"]).toMatchObject({
      source: "npm",
      spec: "@coreblow/voice-call",
      installPath: "/tmp/coreblow-voice-call",
      version: "0.0.2",
    });
    expect(result.config.plugins?.installs?.["voice-call"]).toBeUndefined();
  });

  it("checks marketplace installs during dry-run updates", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.2.0",
      extensions: ["index.ts"],
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
      dryRun: true,
    });

    expect(installPluginFromMarketplaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        marketplace: "vincentkoc/claude-marketplace",
        plugin: "claude-bundle",
        expectedPluginId: "claude-bundle",
        dryRun: true,
      }),
    );
    expect(result.outcomes).toEqual([
      {
        pluginId: "claude-bundle",
        status: "updated",
        currentVersion: undefined,
        nextVersion: "1.2.0",
        message: "Would update claude-bundle: unknown -> 1.2.0.",
      },
    ]);
  });

  it("updates marketplace installs and preserves source metadata", async () => {
    installPluginFromMarketplaceMock.mockResolvedValue({
      ok: true,
      pluginId: "claude-bundle",
      targetDir: "/tmp/claude-bundle",
      version: "1.3.0",
      extensions: ["index.ts"],
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });

    const result = await updateNpmInstalledPlugins({
      config: createMarketplaceInstallConfig({
        pluginId: "claude-bundle",
        installPath: "/tmp/claude-bundle",
        marketplaceName: "Vincent's Claude Plugins",
        marketplaceSource: "vincentkoc/claude-marketplace",
        marketplacePlugin: "claude-bundle",
      }),
      pluginIds: ["claude-bundle"],
    });

    expect(result.changed).toBe(true);
    expect(result.config.plugins?.installs?.["claude-bundle"]).toMatchObject({
      source: "marketplace",
      installPath: "/tmp/claude-bundle",
      version: "1.3.0",
      marketplaceName: "Vincent's Claude Plugins",
      marketplaceSource: "vincentkoc/claude-marketplace",
      marketplacePlugin: "claude-bundle",
    });
  });
});

describe("syncPluginsForUpdateChannel", () => {
  beforeEach(() => {
    installPluginFromNpmSpecMock.mockReset();
    resolveBundledPluginSourcesMock.mockReset();
  });

  it.each([
    {
      name: "keeps bundled path installs on beta without reinstalling from npm",
      config: createBundledPathInstallConfig({
        loadPaths: ["/app/extensions/feishu"],
        installPath: "/app/extensions/feishu",
        spec: "@coreblow/feishu",
      }),
      expectedChanged: false,
      expectedLoadPaths: ["/app/extensions/feishu"],
      expectedInstallPath: "/app/extensions/feishu",
    },
    {
      name: "repairs bundled install metadata when the load path is re-added",
      config: createBundledPathInstallConfig({
        loadPaths: [],
        installPath: "/tmp/old-feishu",
        spec: "@coreblow/feishu",
      }),
      expectedChanged: true,
      expectedLoadPaths: ["/app/extensions/feishu"],
      expectedInstallPath: "/app/extensions/feishu",
    },
  ] as const)(
    "$name",
    async ({ config, expectedChanged, expectedLoadPaths, expectedInstallPath }) => {
      mockBundledSources(createBundledSource());

      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        config,
      });

      expect(installPluginFromNpmSpecMock).not.toHaveBeenCalled();
      expect(result.changed).toBe(expectedChanged);
      expect(result.summary.switchedToNpm).toEqual([]);
      expect(result.config.plugins?.load?.paths).toEqual(expectedLoadPaths);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: "/app/extensions/feishu",
        installPath: expectedInstallPath,
        spec: "@coreblow/feishu",
      });
    },
  );

  it("forwards an explicit env to bundled plugin source resolution", async () => {
    resolveBundledPluginSourcesMock.mockReturnValue(new Map());
    const env = { COREBLOW_HOME: "/srv/coreblow-home" } as NodeJS.ProcessEnv;

    await syncPluginsForUpdateChannel({
      channel: "beta",
      config: {},
      workspaceDir: "/workspace",
      env,
    });

    expect(resolveBundledPluginSourcesMock).toHaveBeenCalledWith({
      workspaceDir: "/workspace",
      env,
    });
  });

  it("uses the provided env when matching bundled load and install paths", async () => {
    const bundledHome = "/tmp/coreblow-home";
    mockBundledSources(
      createBundledSource({
        localPath: `${bundledHome}/plugins/feishu`,
      }),
    );

    const previousHome = process.env.HOME;
    process.env.HOME = "/tmp/process-home";
    try {
      const result = await syncPluginsForUpdateChannel({
        channel: "beta",
        env: {
          ...process.env,
          COREBLOW_HOME: bundledHome,
          HOME: "/tmp/ignored-home",
        },
        config: {
          plugins: {
            load: { paths: ["~/plugins/feishu"] },
            installs: {
              feishu: {
                source: "path",
                sourcePath: "~/plugins/feishu",
                installPath: "~/plugins/feishu",
                spec: "@coreblow/feishu",
              },
            },
          },
        },
      });

      expect(result.changed).toBe(false);
      expect(result.config.plugins?.load?.paths).toEqual(["~/plugins/feishu"]);
      expectBundledPathInstall({
        install: result.config.plugins?.installs?.feishu,
        sourcePath: "~/plugins/feishu",
        installPath: "~/plugins/feishu",
      });
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
    }
  });
});
