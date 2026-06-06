import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listChannelPluginCatalogEntries } from "./catalog.js";

function writeCatalogEntry(params: {
  catalogPath: string;
  name?: string;
  version?: string;
  channelId: string;
  install: Record<string, unknown>;
}) {
  fs.writeFileSync(
    params.catalogPath,
    JSON.stringify({
      entries: [
        {
          ...(params.name ? { name: params.name } : {}),
          ...(params.version ? { version: params.version } : {}),
          coreblow: {
            channel: {
              id: params.channelId,
              label: "Demo Channel",
              selectionLabel: "Demo Channel",
              docsPath: `/channels/${params.channelId}`,
              blurb: "Demo metadata channel.",
            },
            install: params.install,
          },
        },
      ],
    }),
    "utf8",
  );
}

function readCatalogEntry(params: {
  name?: string;
  version?: string;
  channelId?: string;
  install: Record<string, unknown>;
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-channel-catalog-metadata-"));
  const catalogPath = path.join(dir, "catalog.json");
  const channelId = params.channelId ?? "demo-channel";
  writeCatalogEntry({
    catalogPath,
    name: params.name,
    version: params.version,
    channelId,
    install: params.install,
  });
  return listChannelPluginCatalogEntries({
    catalogPaths: [catalogPath],
    env: {
      ...process.env,
      COREBLOW_BUNDLED_PLUGINS_DIR: "/nonexistent/bundled/plugins",
      COREBLOW_STATE_DIR: path.join(dir, "state"),
      COREBLOW_LEGACY_STATE_DIR: path.join(dir, "legacy-state"),
    },
  }).find((entry) => entry.id === channelId);
}

describe("channel plugin catalog install metadata", () => {
  it("surfaces pinned npm install source metadata", () => {
    const entry = readCatalogEntry({
      name: "@coreblow/demo-channel",
      install: {
        npmSpec: "@coreblow/demo-channel@1.2.3",
        defaultChoice: "npm",
        minHostVersion: ">=1.0.0",
        expectedIntegrity: "sha512-demo",
      },
    });

    expect(entry?.install).toMatchObject({
      npmSpec: "@coreblow/demo-channel@1.2.3",
      defaultChoice: "npm",
      minHostVersion: ">=1.0.0",
      expectedIntegrity: "sha512-demo",
    });
    expect(entry?.installSource).toMatchObject({
      defaultChoice: "npm",
      npm: {
        spec: "@coreblow/demo-channel@1.2.3",
        packageName: "@coreblow/demo-channel",
        selector: "1.2.3",
        selectorKind: "exact-version",
        exactVersion: true,
        expectedIntegrity: "sha512-demo",
        pinState: "exact-with-integrity",
      },
      warnings: [],
    });
  });

  it("reports package-name drift in npm install source metadata", () => {
    const entry = readCatalogEntry({
      name: "@coreblow/demo-channel",
      install: {
        npmSpec: "@coreblow/demo-channel-fork@1.2.3",
        expectedIntegrity: "sha512-demo",
      },
    });

    expect(entry?.installSource?.npm).toMatchObject({
      packageName: "@coreblow/demo-channel-fork",
      expectedPackageName: "@coreblow/demo-channel",
    });
    expect(entry?.installSource?.warnings).toContain("npm-spec-package-name-mismatch");
  });

  it("pins bare prerelease npm specs to the external catalog entry version", () => {
    const entry = readCatalogEntry({
      name: "@coreblow/prerelease-channel",
      version: "2026.5.3-beta.1",
      channelId: "prerelease-channel",
      install: {
        npmSpec: "@coreblow/prerelease-channel",
        expectedIntegrity: "sha512-demo",
      },
    });

    expect(entry?.install.npmSpec).toBe("@coreblow/prerelease-channel@2026.5.3-beta.1");
    expect(entry?.installSource?.npm).toMatchObject({
      selector: "2026.5.3-beta.1",
      selectorKind: "exact-version",
      exactVersion: true,
    });
  });

  it("surfaces CoreHub install source metadata", () => {
    const entry = readCatalogEntry({
      channelId: "corehub-channel",
      install: {
        corehubSpec: "corehub:coreblow/corehub-channel@2026.5.2",
        defaultChoice: "corehub",
        minHostVersion: ">=1.0.0",
      },
    });

    expect(entry?.install).toMatchObject({
      corehubSpec: "corehub:coreblow/corehub-channel@2026.5.2",
      defaultChoice: "corehub",
      minHostVersion: ">=1.0.0",
    });
    expect(entry?.installSource).toMatchObject({
      defaultChoice: "corehub",
      corehub: {
        spec: "corehub:coreblow/corehub-channel@2026.5.2",
        packageName: "coreblow/corehub-channel",
        version: "2026.5.2",
        exactVersion: true,
      },
      warnings: [],
    });
  });
});
