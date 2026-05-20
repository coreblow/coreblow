import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as tar from "tar";
import { describe, expect, it } from "vitest";
import { installPluginFromArchive, PLUGIN_INSTALL_ERROR_CODE } from "./install.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-corehub-strict-"));
}

async function packArchive(params: {
  packageJson: Record<string, unknown>;
  manifest?: Record<string, unknown>;
  files?: Record<string, string>;
}): Promise<{ archivePath: string; extensionsDir: string }> {
  const root = makeTempDir();
  const pkgDir = path.join(root, "package");
  fs.mkdirSync(pkgDir, { recursive: true });
  fs.writeFileSync(
    path.join(pkgDir, "package.json"),
    `${JSON.stringify(params.packageJson, null, 2)}\n`,
    "utf-8",
  );
  if (params.manifest) {
    fs.writeFileSync(
      path.join(pkgDir, "coreblow.plugin.json"),
      `${JSON.stringify(params.manifest, null, 2)}\n`,
      "utf-8",
    );
  }
  for (const [relativePath, content] of Object.entries(params.files ?? {})) {
    const target = path.join(pkgDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
  const archivePath = path.join(root, "plugin.tgz");
  await tar.c(
    {
      cwd: root,
      file: archivePath,
      gzip: true,
    },
    ["package"],
  );
  return {
    archivePath,
    extensionsDir: path.join(root, "extensions"),
  };
}

describe("CoreHub strict archive validation", () => {
  it("requires coreblow.plugin.json", async () => {
    const fixture = await packArchive({
      packageJson: {
        name: "strict-missing-manifest",
        version: "0.0.1",
        coreblow: { extensions: ["./dist/index.js"] },
      },
      files: {
        "dist/index.js": "export {};",
      },
    });

    const result = await installPluginFromArchive({
      archivePath: fixture.archivePath,
      extensionsDir: fixture.extensionsDir,
      expectedPluginId: "strict-missing-manifest",
      strictCoreHubArchive: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("coreblow.plugin.json");
      expect(result.code).toBe(PLUGIN_INSTALL_ERROR_CODE.MISSING_PLUGIN_MANIFEST);
    }
  });

  it("requires declared extension entries to exist", async () => {
    const fixture = await packArchive({
      packageJson: {
        name: "strict-missing-entry",
        version: "0.0.1",
        coreblow: { extensions: ["./dist/index.js"] },
      },
      manifest: {
        id: "strict-missing-entry",
        configSchema: { type: "object", properties: {} },
      },
    });

    const result = await installPluginFromArchive({
      archivePath: fixture.archivePath,
      extensionsDir: fixture.extensionsDir,
      expectedPluginId: "strict-missing-entry",
      strictCoreHubArchive: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("extension entry not found");
      expect(result.code).toBe(PLUGIN_INSTALL_ERROR_CODE.MISSING_EXTENSION_ENTRY);
    }
  });

  it("installs valid strict archives", async () => {
    const fixture = await packArchive({
      packageJson: {
        name: "strict-valid",
        version: "0.0.1",
        coreblow: { extensions: ["./dist/index.js"] },
      },
      manifest: {
        id: "strict-valid",
        configSchema: { type: "object", properties: {} },
      },
      files: {
        "dist/index.js": "export {};",
      },
    });

    const result = await installPluginFromArchive({
      archivePath: fixture.archivePath,
      extensionsDir: fixture.extensionsDir,
      expectedPluginId: "strict-valid",
      strictCoreHubArchive: true,
    });

    expect(result).toMatchObject({
      ok: true,
      pluginId: "strict-valid",
      version: "0.0.1",
      extensions: ["./dist/index.js"],
    });
  });
});
