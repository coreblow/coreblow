import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  hasBundledChannelPackageState,
  listBundledChannelIdsForPackageState,
  type ChannelPackageStateCatalogEntry,
} from "./package-state-probes.js";

const tempDirs: string[] = [];
const cfg = {} as CoreBlowConfig;

function makeBundledChannelCatalogEntry(params: {
  pluginId: string;
  channelId: string;
}): ChannelPackageStateCatalogEntry {
  return {
    id: params.channelId,
    pluginId: params.pluginId,
    rootDir: "/tmp/coreblow-channel-plugin",
    channel: {
      id: params.channelId,
      configuredState: {
        env: {
          allOf: ["ALIAS_CHAT_TOKEN"],
        },
      },
    },
  };
}

function removeTempDirs() {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

afterEach(() => {
  removeTempDirs();
});

describe("channel package-state probes", () => {
  it("uses channel ids when manifest plugin ids differ", () => {
    const catalogEntries = [
      makeBundledChannelCatalogEntry({
        pluginId: "vendor-alias-chat-plugin",
        channelId: "alias-chat",
      }),
    ];

    expect(listBundledChannelIdsForPackageState("configuredState", catalogEntries)).toEqual([
      "alias-chat",
    ]);
    expect(
      hasBundledChannelPackageState({
        metadataKey: "configuredState",
        channelId: "alias-chat",
        cfg,
        env: { ALIAS_CHAT_TOKEN: "token" },
        catalogEntries,
      }),
    ).toBe(true);
    expect(
      hasBundledChannelPackageState({
        metadataKey: "configuredState",
        channelId: "vendor-alias-chat-plugin",
        cfg,
        env: { ALIAS_CHAT_TOKEN: "token" },
        catalogEntries,
      }),
    ).toBe(false);
  });

  it("prefers built bundled package-state probes when the catalog root is source", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-package-state-probe-"));
    tempDirs.push(root);
    const sourceRoot = path.join(root, "extensions", "matrix");
    const builtRoot = path.join(root, "dist", "extensions", "matrix");
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(builtRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, "auth-presence.ts"),
      "throw new Error('source probe should not load');\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(builtRoot, "auth-presence.js"),
      "module.exports.hasAnyMatrixAuth = () => true;\n",
      "utf8",
    );

    expect(
      hasBundledChannelPackageState({
        metadataKey: "persistedAuthState",
        channelId: "matrix",
        cfg,
        catalogEntries: [
          {
            id: "matrix",
            pluginId: "matrix",
            rootDir: sourceRoot,
            channel: {
              id: "matrix",
              persistedAuthState: {
                specifier: "./auth-presence",
                exportName: "hasAnyMatrixAuth",
              },
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it("falls back to source package-state probes when built artifacts are stale", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-package-state-fallback-"));
    tempDirs.push(root);
    const sourceRoot = path.join(root, "extensions", "whatsapp");
    const builtRoot = path.join(root, "dist", "extensions", "whatsapp");
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(builtRoot, { recursive: true });
    fs.writeFileSync(
      path.join(sourceRoot, "auth-presence.js"),
      "module.exports.hasAnyWhatsAppAuth = () => true;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(builtRoot, "auth-presence.js"),
      "module.exports.stale = () => false;\n",
      "utf8",
    );

    expect(
      hasBundledChannelPackageState({
        metadataKey: "persistedAuthState",
        channelId: "whatsapp",
        cfg,
        catalogEntries: [
          {
            id: "whatsapp",
            pluginId: "whatsapp",
            rootDir: sourceRoot,
            channel: {
              id: "whatsapp",
              persistedAuthState: {
                specifier: "./auth-presence",
                exportName: "hasAnyWhatsAppAuth",
              },
            },
          },
        ],
      }),
    ).toBe(true);
  });
});
