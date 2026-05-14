import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withTempHome } from "../../config/home-env.test-harness.js";
import { handleCommands } from "./commands-core.js";
import { createCommandWorkspaceHarness } from "./commands-filesystem.test-support.js";
import { buildCommandTestParams } from "./commands.test-harness.js";

const installPluginFromPathMock = vi.fn();
const installPluginFromCoreHubMock = vi.fn();
const persistPluginInstallMock = vi.fn();

vi.mock("../../plugins/install.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/install.js")>(
    "../../plugins/install.js",
  );
  return {
    ...actual,
    installPluginFromPath: installPluginFromPathMock,
  };
});

vi.mock("../../plugins/coreblow-hub.js", async () => {
  const actual = await vi.importActual<typeof import("../../plugins/coreblow-hub.js")>(
    "../../plugins/coreblow-hub.js",
  );
  return {
    ...actual,
    installPluginFromCoreHub: installPluginFromCoreHubMock,
  };
});

vi.mock("../../cli/plugins-install-persist.js", () => ({
  persistPluginInstall: persistPluginInstallMock,
}));

const workspaceHarness = createCommandWorkspaceHarness("coreblow-command-plugins-install-");

describe("handleCommands /plugins install", () => {
  afterEach(async () => {
    installPluginFromPathMock.mockReset();
    installPluginFromCoreHubMock.mockReset();
    persistPluginInstallMock.mockReset();
    await workspaceHarness.cleanupWorkspaces();
  });

  it("installs a plugin from a local path", async () => {
    installPluginFromPathMock.mockResolvedValue({
      ok: true,
      pluginId: "path-install-plugin",
      targetDir: "/tmp/path-install-plugin",
      version: "0.0.1",
      extensions: ["index.js"],
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("coreblow-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const pluginDir = path.join(workspaceDir, "fixtures", "path-install-plugin");
      await fs.mkdir(pluginDir, { recursive: true });

      const params = buildCommandTestParams(
        `/plugins install ${pluginDir}`,
        {
          commands: {
            text: true,
            plugins: true,
          },
        },
        undefined,
        { workspaceDir },
      );
      params.command.senderIsOwner = true;

      const result = await handleCommands(params);
      expect(result.reply?.text).toContain('Installed plugin "path-install-plugin"');
      expect(installPluginFromPathMock).toHaveBeenCalledWith(
        expect.objectContaining({
          path: pluginDir,
        }),
      );
      expect(persistPluginInstallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: "path-install-plugin",
          install: expect.objectContaining({
            source: "path",
            sourcePath: pluginDir,
            installPath: "/tmp/path-install-plugin",
            version: "0.0.1",
          }),
        }),
      );
    });
  });

  it("installs from an explicit corehub: spec", async () => {
    installPluginFromCoreHubMock.mockResolvedValue({
      ok: true,
      pluginId: "corehub-demo",
      targetDir: "/tmp/corehub-demo",
      version: "1.2.3",
      extensions: ["index.js"],
      packageName: "@coreblow/corehub-demo",
      corehub: {
        source: "corehub",
        corehubUrl: "https://corehub.ai",
        corehubPackage: "@coreblow/corehub-demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
        version: "1.2.3",
        integrity: "sha512-demo",
        resolvedAt: "2026-03-22T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("coreblow-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildCommandTestParams(
        "/plugins install corehub:@coreblow/corehub-demo@1.2.3",
        {
          commands: {
            text: true,
            plugins: true,
          },
        },
        undefined,
        { workspaceDir },
      );
      params.command.senderIsOwner = true;

      const result = await handleCommands(params);
      expect(result.reply?.text).toContain('Installed plugin "corehub-demo"');
      expect(installPluginFromCoreHubMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: "corehub:@coreblow/corehub-demo@1.2.3",
        }),
      );
      expect(persistPluginInstallMock).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: "corehub-demo",
          install: expect.objectContaining({
            source: "corehub",
            spec: "corehub:@coreblow/corehub-demo@1.2.3",
            installPath: "/tmp/corehub-demo",
            version: "1.2.3",
            integrity: "sha512-demo",
            corehubPackage: "@coreblow/corehub-demo",
            corehubChannel: "official",
          }),
        }),
      );
    });
  });

  it("treats /plugin add as an install alias", async () => {
    installPluginFromCoreHubMock.mockResolvedValue({
      ok: true,
      pluginId: "alias-demo",
      targetDir: "/tmp/alias-demo",
      version: "1.0.0",
      extensions: ["index.js"],
      packageName: "@coreblow/alias-demo",
      corehub: {
        source: "corehub",
        corehubUrl: "https://corehub.ai",
        corehubPackage: "@coreblow/alias-demo",
        corehubFamily: "code-plugin",
        corehubChannel: "official",
        version: "1.0.0",
        integrity: "sha512-alias",
        resolvedAt: "2026-03-23T12:00:00.000Z",
      },
    });
    persistPluginInstallMock.mockResolvedValue({});

    await withTempHome("coreblow-command-plugins-home-", async () => {
      const workspaceDir = await workspaceHarness.createWorkspace();
      const params = buildCommandTestParams(
        "/plugin add corehub:@coreblow/alias-demo@1.0.0",
        {
          commands: {
            text: true,
            plugins: true,
          },
        },
        undefined,
        { workspaceDir },
      );
      params.command.senderIsOwner = true;

      const result = await handleCommands(params);
      expect(result.reply?.text).toContain('Installed plugin "alias-demo"');
      expect(installPluginFromCoreHubMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: "corehub:@coreblow/alias-demo@1.0.0",
        }),
      );
    });
  });
});
