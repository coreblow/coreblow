import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePreferredCoreBlowTmpDir } from "../../../../infra/tmp-coreblow-dir.js";
import { listChannelPluginCatalogEntries } from "../../catalog.js";

function createCatalogEntry(params: {
  packageName?: string;
  version?: string;
  channelId: string;
  label: string;
  blurb: string;
  order?: number;
  install?: Record<string, unknown>;
}) {
  return {
    ...(params.packageName ? { name: params.packageName } : {}),
    ...(params.version ? { version: params.version } : {}),
    coreblow: {
      channel: {
        id: params.channelId,
        label: params.label,
        selectionLabel: params.label,
        docsPath: `/channels/${params.channelId}`,
        blurb: params.blurb,
        ...(params.order === undefined ? {} : { order: params.order }),
      },
      install: params.install ?? {
        npmSpec: params.packageName,
      },
    },
  };
}

function writeCatalogFile(catalogPath: string, entry: Record<string, unknown>) {
  fs.writeFileSync(
    catalogPath,
    JSON.stringify({
      entries: [entry],
    }),
    "utf8",
  );
}

function writeDiscoveredChannelPlugin(params: {
  stateDir: string;
  packageName: string;
  channelLabel: string;
  pluginId: string;
  blurb: string;
}) {
  const pluginDir = path.join(params.stateDir, "extensions", "demo-channel-plugin");
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, "package.json"),
    JSON.stringify({
      name: params.packageName,
      coreblow: {
        extensions: ["./index.js"],
        channel: {
          id: "demo-channel",
          label: params.channelLabel,
          selectionLabel: params.channelLabel,
          docsPath: "/channels/demo-channel",
          blurb: params.blurb,
        },
        install: {
          npmSpec: params.packageName,
        },
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(pluginDir, "coreblow.plugin.json"),
    JSON.stringify({
      id: params.pluginId,
      configSchema: {},
    }),
    "utf8",
  );
  fs.writeFileSync(path.join(pluginDir, "index.js"), "module.exports = {}", "utf8");
}

function expectCatalogIdsContain(params: {
  expectedId: string;
  catalogPaths?: string[];
  env?: NodeJS.ProcessEnv;
}) {
  const ids = listChannelPluginCatalogEntries({
    ...(params.catalogPaths ? { catalogPaths: params.catalogPaths } : {}),
    ...(params.env ? { env: params.env } : {}),
  }).map((entry) => entry.id);
  expect(ids).toContain(params.expectedId);
}

function findCatalogEntry(params: {
  channelId: string;
  catalogPaths?: string[];
  env?: NodeJS.ProcessEnv;
}) {
  return listChannelPluginCatalogEntries({
    ...(params.catalogPaths ? { catalogPaths: params.catalogPaths } : {}),
    ...(params.env ? { env: params.env } : {}),
  }).find((entry) => entry.id === params.channelId);
}

function expectCatalogEntryMatch(params: {
  channelId: string;
  expected: Record<string, unknown>;
  catalogPaths?: string[];
  env?: NodeJS.ProcessEnv;
}) {
  expect(
    findCatalogEntry({
      channelId: params.channelId,
      ...(params.catalogPaths ? { catalogPaths: params.catalogPaths } : {}),
      ...(params.env ? { env: params.env } : {}),
    }),
  ).toMatchObject(params.expected);
}

function createFallbackOnlyEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    COREBLOW_BUNDLED_PLUGINS_DIR: "/nonexistent/bundled/plugins",
    COREBLOW_STATE_DIR: "/nonexistent/coreblow/state",
    COREBLOW_LEGACY_STATE_DIR: "/nonexistent/coreblow/legacy-state",
    ...overrides,
  };
}

export function describeChannelPluginCatalogEntriesContract() {
  describe("channel plugin catalog entries contract", () => {
    it.each([
      {
        name: "includes external catalog entries",
        setup: () => {
          const dir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-"),
          );
          const catalogPath = path.join(dir, "catalog.json");
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@coreblow/demo-channel",
              channelId: "demo-channel",
              label: "Demo Channel",
              blurb: "Demo entry",
              order: 999,
            }),
          );
          return {
            channelId: "demo-channel",
            catalogPaths: [catalogPath],
            expected: { id: "demo-channel" },
          };
        },
      },
      {
        name: "preserves plugin ids when they differ from channel ids",
        setup: () => {
          const stateDir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-channel-catalog-state-"),
          );
          writeDiscoveredChannelPlugin({
            stateDir,
            packageName: "@vendor/demo-channel-plugin",
            channelLabel: "Demo Channel",
            pluginId: "@vendor/demo-runtime",
            blurb: "Demo channel",
          });
          return {
            channelId: "demo-channel",
            env: createFallbackOnlyEnv({
              COREBLOW_STATE_DIR: stateDir,
            }),
            expected: { pluginId: "@vendor/demo-runtime" },
          };
        },
      },
      {
        name: "keeps discovered plugins ahead of external catalog overrides",
        setup: () => {
          const stateDir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-state-"),
          );
          const catalogPath = path.join(stateDir, "catalog.json");
          writeDiscoveredChannelPlugin({
            stateDir,
            packageName: "@vendor/demo-channel-plugin",
            channelLabel: "Demo Channel Runtime",
            pluginId: "@vendor/demo-channel-runtime",
            blurb: "discovered plugin",
          });
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@vendor/demo-channel-catalog",
              channelId: "demo-channel",
              label: "Demo Channel Catalog",
              blurb: "external catalog",
            }),
          );
          return {
            channelId: "demo-channel",
            catalogPaths: [catalogPath],
            env: createFallbackOnlyEnv({
              COREBLOW_STATE_DIR: stateDir,
            }),
            expected: {
              install: { npmSpec: "@vendor/demo-channel-plugin" },
              meta: { label: "Demo Channel Runtime" },
              pluginId: "@vendor/demo-channel-runtime",
            },
          };
        },
      },
      {
        name: "accepts rich external manifest entries with pinned npm metadata",
        setup: () => {
          const dir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-rich-"),
          );
          const catalogPath = path.join(dir, "catalog.json");
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@coreblow/rich-demo-channel",
              channelId: "rich-demo",
              label: "Rich Demo",
              blurb: "Rich metadata fixture",
              install: {
                npmSpec: "@coreblow/rich-demo-channel@1.2.3",
                defaultChoice: "npm",
                minHostVersion: ">=1.0.0",
                expectedIntegrity: "sha512-rich",
              },
            }),
          );
          return {
            channelId: "rich-demo",
            catalogPaths: [catalogPath],
            expected: {
              install: {
                npmSpec: "@coreblow/rich-demo-channel@1.2.3",
                defaultChoice: "npm",
                minHostVersion: ">=1.0.0",
                expectedIntegrity: "sha512-rich",
              },
              installSource: {
                npm: {
                  selectorKind: "exact-version",
                  exactVersion: true,
                  pinState: "exact-with-integrity",
                },
                warnings: [],
              },
            },
          };
        },
      },
      {
        name: "pins bare external prerelease package specs to the entry version",
        setup: () => {
          const dir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-prerelease-"),
          );
          const catalogPath = path.join(dir, "catalog.json");
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@coreblow/prerelease-demo-channel",
              version: "2026.5.3-beta.1",
              channelId: "prerelease-demo",
              label: "Prerelease Demo",
              blurb: "Prerelease package pinning fixture",
              install: {
                npmSpec: "@coreblow/prerelease-demo-channel",
                expectedIntegrity: "sha512-prerelease",
              },
            }),
          );
          return {
            channelId: "prerelease-demo",
            catalogPaths: [catalogPath],
            expected: {
              install: { npmSpec: "@coreblow/prerelease-demo-channel@2026.5.3-beta.1" },
              installSource: {
                npm: {
                  selector: "2026.5.3-beta.1",
                  selectorKind: "exact-version",
                  exactVersion: true,
                },
              },
            },
          };
        },
      },
      {
        name: "accepts external manifest entries with CoreHub install metadata",
        setup: () => {
          const dir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-corehub-"),
          );
          const catalogPath = path.join(dir, "catalog.json");
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              channelId: "corehub-chat",
              label: "CoreHub Chat",
              blurb: "CoreHub-backed chat channel.",
              install: {
                corehubSpec: "corehub:coreblow/corehub-chat@2026.5.2",
                defaultChoice: "corehub",
                minHostVersion: ">=1.0.0",
              },
            }),
          );
          return {
            channelId: "corehub-chat",
            catalogPaths: [catalogPath],
            expected: {
              install: {
                corehubSpec: "corehub:coreblow/corehub-chat@2026.5.2",
                defaultChoice: "corehub",
                minHostVersion: ">=1.0.0",
              },
              installSource: {
                defaultChoice: "corehub",
                corehub: {
                  packageName: "coreblow/corehub-chat",
                  version: "2026.5.2",
                  exactVersion: true,
                },
                warnings: [],
              },
            },
          };
        },
      },
    ] as const)("$name", ({ setup }) => {
      const setupResult = setup();
      const { channelId, expected } = setupResult;
      expectCatalogEntryMatch({
        channelId,
        expected,
        ...("catalogPaths" in setupResult ? { catalogPaths: setupResult.catalogPaths } : {}),
        ...("env" in setupResult ? { env: setupResult.env } : {}),
      });
    });
  });
}

export function describeChannelPluginCatalogPathResolutionContract() {
  describe("channel plugin catalog path resolution contract", () => {
    it.each([
      {
        name: "uses the provided env for external catalog path resolution",
        setup: () => {
          const home = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-home-"),
          );
          const catalogPath = path.join(home, "catalog.json");
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@coreblow/env-demo-channel",
              channelId: "env-demo-channel",
              label: "Env Demo Channel",
              blurb: "Env demo entry",
              order: 1000,
            }),
          );
          return {
            env: createFallbackOnlyEnv({
              COREBLOW_PLUGIN_CATALOG_PATHS: "~/catalog.json",
              COREBLOW_HOME: home,
              HOME: home,
            }),
            expectedId: "env-demo-channel",
          };
        },
      },
      {
        name: "uses the provided env for default catalog paths",
        setup: () => {
          const stateDir = fs.mkdtempSync(
            path.join(resolvePreferredCoreBlowTmpDir(), "coreblow-catalog-state-"),
          );
          const catalogPath = path.join(stateDir, "plugins", "catalog.json");
          fs.mkdirSync(path.dirname(catalogPath), { recursive: true });
          writeCatalogFile(
            catalogPath,
            createCatalogEntry({
              packageName: "@coreblow/default-env-demo",
              channelId: "default-env-demo",
              label: "Default Env Demo",
              blurb: "Default env entry",
            }),
          );
          return {
            env: createFallbackOnlyEnv({
              COREBLOW_STATE_DIR: stateDir,
            }),
            expectedId: "default-env-demo",
          };
        },
      },
    ] as const)("$name", ({ setup }) => {
      const { env, expectedId } = setup();
      expectCatalogIdsContain({ env, expectedId });
    });
  });
}
