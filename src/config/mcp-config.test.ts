import fs from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  canonicalizeConfiguredMcpServer,
  listConfiguredMcpServers,
  normalizeConfiguredMcpServers,
  resolveCoreBlowMcpTransportAlias,
  setConfiguredMcpServer,
  unsetConfiguredMcpServer,
} from "./mcp-config.js";
import { withTempHomeConfig } from "./test-helpers.js";

describe("config mcp config", () => {
  it("writes and removes top-level mcp servers", async () => {
    await withTempHomeConfig({}, async () => {
      const setResult = await setConfiguredMcpServer({
        name: "context7",
        server: {
          command: "uvx",
          args: ["context7-mcp"],
        },
      });

      expect(setResult.ok).toBe(true);
      const loaded = await listConfiguredMcpServers();
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) {
        throw new Error("expected MCP config to load");
      }
      expect(loaded.mcpServers.context7).toEqual({
        command: "uvx",
        args: ["context7-mcp"],
      });

      const unsetResult = await unsetConfiguredMcpServer({ name: "context7" });
      expect(unsetResult.ok).toBe(true);

      const reloaded = await listConfiguredMcpServers();
      expect(reloaded.ok).toBe(true);
      if (!reloaded.ok) {
        throw new Error("expected MCP config to reload");
      }
      expect(reloaded.mcpServers).toEqual({});
    });
  });

  it("fails closed when the config file is invalid", async () => {
    await withTempHomeConfig({}, async ({ configPath }) => {
      await fs.writeFile(configPath, "{", "utf-8");

      const loaded = await listConfiguredMcpServers();
      expect(loaded.ok).toBe(false);
      if (loaded.ok) {
        throw new Error("expected invalid config to fail");
      }
      expect(loaded.path).toBe(configPath);
    });
  });

  it("maps CLI-native MCP type aliases to CoreBlow transports", () => {
    expect(resolveCoreBlowMcpTransportAlias("http")).toBe("streamable-http");
    expect(resolveCoreBlowMcpTransportAlias(" streamable-http ")).toBe("streamable-http");
    expect(resolveCoreBlowMcpTransportAlias("SSE")).toBe("sse");
    expect(resolveCoreBlowMcpTransportAlias("stdio")).toBeUndefined();
  });

  it("canonicalizes configured MCP servers without mutating the original", () => {
    const raw = {
      context7: { type: "http", url: "https://mcp.example.com/http" },
      stdio: { type: "stdio", command: "node" },
      explicit: { type: "http", transport: "sse", url: "https://mcp.example.com/sse" },
      unknown: { type: "custom", url: "https://mcp.example.com/custom" },
      invalid: "skip",
    };

    expect(normalizeConfiguredMcpServers(raw)).toEqual({
      context7: { transport: "streamable-http", url: "https://mcp.example.com/http" },
      stdio: { command: "node" },
      explicit: { transport: "sse", url: "https://mcp.example.com/sse" },
      unknown: { type: "custom", url: "https://mcp.example.com/custom" },
    });
    expect(raw.context7).toEqual({ type: "http", url: "https://mcp.example.com/http" });
  });

  it("canonicalizes one configured MCP server", () => {
    expect(canonicalizeConfiguredMcpServer({ type: "sse", url: "https://mcp.example.com/sse" }))
      .toEqual({
        transport: "sse",
        url: "https://mcp.example.com/sse",
      });
  });
});
