import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteMcpServer,
  getMcpCatalog,
  getMcpServer,
  installFromCatalog,
  listMcpServers,
  loadMcpServersSync,
  probeMcpServer,
  resolveMcpServersPath,
  saveMcpServersSync,
  upsertMcpServer,
} from "./mcp-registry.js";

describe("MCP 1-Click Server Registry", () => {
  let tempDir: string;
  let testStorePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-mcp-test-"));
    testStorePath = path.join(tempDir, "servers.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("resolves default and custom servers.json paths", () => {
    expect(resolveMcpServersPath(testStorePath)).toBe(testStorePath);
    const defaultPath = resolveMcpServersPath();
    expect(defaultPath).toMatch(/mcp[/\\]servers\.json$/);
  });

  it("provides a curated CoreBlow MCP Catalog with official tools", () => {
    const catalog = getMcpCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(8);
    const ids = catalog.map((c) => c.id);
    expect(ids).toContain("github");
    expect(ids).toContain("filesystem");
    expect(ids).toContain("postgres");
    expect(ids).toContain("sqlite");
    expect(ids).toContain("playwright");
    expect(ids).toContain("fetch");
    expect(ids).toContain("memory");
  });

  it("installs, lists, and uninstalls MCP servers from catalog", () => {
    const installed = installFromCatalog("filesystem", testStorePath);
    expect(installed.id).toBe("filesystem");
    expect(installed.name).toBe("Filesystem");
    expect(installed.transport).toBe("stdio");
    expect(installed.enabled).toBe(true);

    const list = listMcpServers(testStorePath);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe("filesystem");

    const fetched = getMcpServer("filesystem", testStorePath);
    expect(fetched).toBeDefined();
    expect(fetched?.command).toBe("npx");

    const deleted = deleteMcpServer("filesystem", testStorePath);
    expect(deleted).toBe(true);
    expect(listMcpServers(testStorePath).length).toBe(0);
  });

  it("probes stdio servers by PATH binary existence", async () => {
    // Node is always in PATH
    const probeSuccess = await probeMcpServer({
      id: "test-node",
      name: "Node Test",
      transport: "stdio",
      command: "node",
      enabled: true,
      status: "disconnected",
    });
    expect(probeSuccess.ok).toBe(true);
    expect(probeSuccess.status).toBe("connected");

    // Non-existent binary
    const probeFail = await probeMcpServer({
      id: "test-missing",
      name: "Missing Test",
      transport: "stdio",
      command: "non_existent_binary_xyz_999",
      enabled: true,
      status: "disconnected",
    });
    expect(probeFail.ok).toBe(false);
    expect(probeFail.status).toBe("error");
  });
});
