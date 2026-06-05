import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ACP_BUNDLED_BIN,
  ACP_PINNED_VERSION,
  createAcpPluginConfigSchema,
  resolveAcpPluginRoot,
  resolveAcpPluginConfig,
} from "./config.js";

describe("acp plugin config parsing", () => {
  it("resolves source-layout plugin root from a file under src", () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acp-root-source-"));
    try {
      fs.mkdirSync(path.join(pluginRoot, "src"), { recursive: true });
      fs.writeFileSync(path.join(pluginRoot, "package.json"), "{}\n", "utf8");
      fs.writeFileSync(path.join(pluginRoot, "coreblow.plugin.json"), "{}\n", "utf8");

      const moduleUrl = pathToFileURL(path.join(pluginRoot, "src", "config.ts")).href;
      expect(resolveAcpPluginRoot(moduleUrl)).toBe(pluginRoot);
    } finally {
      fs.rmSync(pluginRoot, { recursive: true, force: true });
    }
  });

  it("resolves bundled-layout plugin root from the dist entry file", () => {
    const pluginRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acp-root-dist-"));
    try {
      fs.writeFileSync(path.join(pluginRoot, "package.json"), "{}\n", "utf8");
      fs.writeFileSync(path.join(pluginRoot, "coreblow.plugin.json"), "{}\n", "utf8");

      const moduleUrl = pathToFileURL(path.join(pluginRoot, "index.js")).href;
      expect(resolveAcpPluginRoot(moduleUrl)).toBe(pluginRoot);
    } finally {
      fs.rmSync(pluginRoot, { recursive: true, force: true });
    }
  });

  it("prefers the workspace plugin root for dist/extensions/acp bundles", () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "acp-root-workspace-"));
    const workspacePluginRoot = path.join(repoRoot, "extensions", "acp");
    const bundledPluginRoot = path.join(repoRoot, "dist", "extensions", "acp");
    try {
      fs.mkdirSync(workspacePluginRoot, { recursive: true });
      fs.mkdirSync(bundledPluginRoot, { recursive: true });
      fs.writeFileSync(path.join(workspacePluginRoot, "package.json"), "{}\n", "utf8");
      fs.writeFileSync(path.join(workspacePluginRoot, "coreblow.plugin.json"), "{}\n", "utf8");
      fs.writeFileSync(path.join(bundledPluginRoot, "package.json"), "{}\n", "utf8");
      fs.writeFileSync(path.join(bundledPluginRoot, "coreblow.plugin.json"), "{}\n", "utf8");

      const moduleUrl = pathToFileURL(path.join(bundledPluginRoot, "index.js")).href;
      expect(resolveAcpPluginRoot(moduleUrl)).toBe(workspacePluginRoot);
    } finally {
      fs.rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("resolves bundled acp with pinned version by default", () => {
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        cwd: "/tmp/workspace",
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.command).toBe(ACP_BUNDLED_BIN);
    expect(resolved.expectedVersion).toBe(ACP_PINNED_VERSION);
    expect(resolved.allowPluginLocalInstall).toBe(true);
    expect(resolved.stripProviderAuthEnvVars).toBe(true);
    expect(resolved.cwd).toBe(path.resolve("/tmp/workspace"));
    expect(resolved.strictWindowsCmdWrapper).toBe(true);
  });

  it("accepts command override and disables plugin-local auto-install", () => {
    const command = "/home/user/repos/acp/dist/cli.js";
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        command,
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.command).toBe(path.resolve(command));
    expect(resolved.expectedVersion).toBeUndefined();
    expect(resolved.allowPluginLocalInstall).toBe(false);
    expect(resolved.stripProviderAuthEnvVars).toBe(false);
  });

  it("resolves relative command paths against workspace directory", () => {
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        command: "../acp/dist/cli.js",
      },
      workspaceDir: "/home/user/repos/coreblow",
    });

    expect(resolved.command).toBe(path.resolve("/home/user/repos/coreblow", "../acp/dist/cli.js"));
    expect(resolved.expectedVersion).toBeUndefined();
    expect(resolved.allowPluginLocalInstall).toBe(false);
    expect(resolved.stripProviderAuthEnvVars).toBe(false);
  });

  it("keeps bare command names as-is", () => {
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        command: "acp",
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.command).toBe("acp");
    expect(resolved.expectedVersion).toBeUndefined();
    expect(resolved.allowPluginLocalInstall).toBe(false);
    expect(resolved.stripProviderAuthEnvVars).toBe(false);
  });

  it("accepts exact expectedVersion override", () => {
    const command = "/home/user/repos/acp/dist/cli.js";
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        command,
        expectedVersion: "0.1.99",
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.command).toBe(path.resolve(command));
    expect(resolved.expectedVersion).toBe("0.1.99");
    expect(resolved.allowPluginLocalInstall).toBe(false);
    expect(resolved.stripProviderAuthEnvVars).toBe(false);
  });

  it("treats expectedVersion=any as no version constraint", () => {
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        command: "/home/user/repos/acp/dist/cli.js",
        expectedVersion: "any",
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.expectedVersion).toBeUndefined();
  });

  it("rejects commandArgs overrides", () => {
    expect(() =>
      resolveAcpPluginConfig({
        rawConfig: {
          commandArgs: ["--foo"],
        },
        workspaceDir: "/tmp/workspace",
      }),
    ).toThrow("unknown config key: commandArgs");
  });

  it("schema rejects empty cwd", () => {
    const schema = createAcpPluginConfigSchema();
    if (!schema.safeParse) {
      throw new Error("acp config schema missing safeParse");
    }
    const parsed = schema.safeParse({ cwd: "   " });

    expect(parsed.success).toBe(false);
  });

  it("accepts strictWindowsCmdWrapper override", () => {
    const resolved = resolveAcpPluginConfig({
      rawConfig: {
        strictWindowsCmdWrapper: true,
      },
      workspaceDir: "/tmp/workspace",
    });

    expect(resolved.strictWindowsCmdWrapper).toBe(true);
  });

  it("rejects non-boolean strictWindowsCmdWrapper", () => {
    expect(() =>
      resolveAcpPluginConfig({
        rawConfig: {
          strictWindowsCmdWrapper: "yes",
        },
        workspaceDir: "/tmp/workspace",
      }),
    ).toThrow("strictWindowsCmdWrapper must be a boolean");
  });

  it("keeps the runtime json schema in sync with the manifest config schema", () => {
    const manifest = JSON.parse(
      fs.readFileSync(new URL("../coreblow.plugin.json", import.meta.url), "utf8"),
    ) as { configSchema?: unknown };

    expect(createAcpPluginConfigSchema().jsonSchema).toEqual(manifest.configSchema);
  });
});
