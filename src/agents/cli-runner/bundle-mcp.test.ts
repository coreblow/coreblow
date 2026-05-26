import fs from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import {
  createBundleMcpTempHarness,
  createBundleProbePlugin,
} from "../../plugins/bundle-mcp.test-support.js";
import { captureEnv } from "../../test-utils/env.js";
import { prepareCliBundleMcpConfig } from "./bundle-mcp.js";

const tempHarness = createBundleMcpTempHarness();

afterEach(async () => {
  await tempHarness.cleanup();
});

describe("prepareCliBundleMcpConfig", () => {
  it("injects a strict empty --mcp-config overlay for bundle-MCP-enabled backends without servers", async () => {
    const workspaceDir = await tempHarness.createTempDir("coreblow-cli-bundle-mcp-empty-");

    const prepared = await prepareCliBundleMcpConfig({
      enabled: true,
      backend: {
        command: "node",
        args: ["./fake-claude.mjs"],
      },
      workspaceDir,
      config: {},
    });

    const configFlagIndex = prepared.backend.args?.indexOf("--mcp-config") ?? -1;
    expect(configFlagIndex).toBeGreaterThanOrEqual(0);
    expect(prepared.backend.args).toContain("--strict-mcp-config");
    const generatedConfigPath = prepared.backend.args?.[configFlagIndex + 1];
    expect(typeof generatedConfigPath).toBe("string");
    const raw = JSON.parse(await fs.readFile(generatedConfigPath as string, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };
    expect(raw.mcpServers).toEqual({});

    await prepared.cleanup?.();
  });

  it("injects a merged --mcp-config overlay for bundle-MCP-enabled backends", async () => {
    const env = captureEnv(["HOME"]);
    try {
      const homeDir = await tempHarness.createTempDir("coreblow-cli-bundle-mcp-home-");
      const workspaceDir = await tempHarness.createTempDir("coreblow-cli-bundle-mcp-workspace-");
      process.env.HOME = homeDir;

      const { serverPath } = await createBundleProbePlugin(homeDir);

      const config: CoreBlowConfig = {
        plugins: {
          entries: {
            "bundle-probe": { enabled: true },
          },
        },
      };

      const prepared = await prepareCliBundleMcpConfig({
        enabled: true,
        backend: {
          command: "node",
          args: ["./fake-claude.mjs"],
        },
        workspaceDir,
        config,
      });

      const configFlagIndex = prepared.backend.args?.indexOf("--mcp-config") ?? -1;
      expect(configFlagIndex).toBeGreaterThanOrEqual(0);
      expect(prepared.backend.args).toContain("--strict-mcp-config");
      const generatedConfigPath = prepared.backend.args?.[configFlagIndex + 1];
      expect(typeof generatedConfigPath).toBe("string");
      const raw = JSON.parse(await fs.readFile(generatedConfigPath as string, "utf-8")) as {
        mcpServers?: Record<string, { args?: string[] }>;
      };
      expect(raw.mcpServers?.bundleProbe?.args).toEqual([await fs.realpath(serverPath)]);
      expect(prepared.mcpConfigHash).toMatch(/^[0-9a-f]{64}$/);

      await prepared.cleanup?.();
    } finally {
      env.restore();
    }
  });

  it("merges loopback MCP config and env into bundle-MCP-enabled backends", async () => {
    const workspaceDir = await tempHarness.createTempDir("coreblow-cli-bundle-mcp-loopback-");

    const prepared = await prepareCliBundleMcpConfig({
      enabled: true,
      backend: {
        command: "node",
        args: ["./fake-claude.mjs"],
        env: { EXISTING_ENV: "1" },
      },
      workspaceDir,
      additionalConfig: {
        mcpServers: {
          coreblow: {
            type: "http",
            url: "http://127.0.0.1:4567/mcp",
            headers: {
              Authorization: "Bearer ${COREBLOW_MCP_TOKEN}",
              "x-coreblow-message-channel": "${COREBLOW_MCP_MESSAGE_CHANNEL}",
            },
          },
        },
      },
      env: {
        COREBLOW_MCP_TOKEN: "owner-token",
        COREBLOW_MCP_MESSAGE_CHANNEL: "telegram",
      },
    });

    const configFlagIndex = prepared.backend.args?.indexOf("--mcp-config") ?? -1;
    const generatedConfigPath = prepared.backend.args?.[configFlagIndex + 1];
    const raw = JSON.parse(await fs.readFile(generatedConfigPath as string, "utf-8")) as {
      mcpServers?: Record<string, unknown>;
    };

    expect(raw.mcpServers?.coreblow).toEqual({
      type: "http",
      url: "http://127.0.0.1:4567/mcp",
      headers: {
        Authorization: "Bearer ${COREBLOW_MCP_TOKEN}",
        "x-coreblow-message-channel": "${COREBLOW_MCP_MESSAGE_CHANNEL}",
      },
    });
    expect(prepared.backend.env).toEqual({
      EXISTING_ENV: "1",
      COREBLOW_MCP_TOKEN: "owner-token",
      COREBLOW_MCP_MESSAGE_CHANNEL: "telegram",
    });

    await prepared.cleanup?.();
  });

  it("leaves args untouched when bundle MCP is disabled", async () => {
    const prepared = await prepareCliBundleMcpConfig({
      enabled: false,
      backend: {
        command: "node",
        args: ["./fake-cli.mjs"],
      },
      workspaceDir: "/tmp/coreblow-bundle-mcp-disabled",
    });

    expect(prepared.backend.args).toEqual(["./fake-cli.mjs"]);
    expect(prepared.cleanup).toBeUndefined();
  });
});
