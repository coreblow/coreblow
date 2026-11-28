import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/memory-core-host-engine-foundation";
import { afterAll, describe, expect, it, vi } from "vitest";
import "./test-runtime-mocks.js";
import { getRequiredMemoryIndexManager } from "./test-manager-helpers.js";

vi.mock("./embeddings.js", () => ({
  createEmbeddingProvider: async () => ({
    requestedProvider: "auto",
    provider: null,
    providerUnavailableReason: "No embedding API key configured in test",
  }),
}));

describe("MemoryIndexManager FTS-only mode", () => {
  let workspaceDir = "";

  afterAll(async () => {
    if (workspaceDir) {
      await fs.rm(workspaceDir, { recursive: true, force: true });
    }
  });

  it("syncs workspace markdown files and returns FTS5 search matches without an embedding provider", async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-mem-fts-only-"));
    const indexPath = path.join(workspaceDir, "index.sqlite");
    await fs.writeFile(
      path.join(workspaceDir, "MEMORY.md"),
      "# QC Memory\nProject codename is ORION-7741.\n",
      "utf-8",
    );

    const cfg = {
      agents: {
        defaults: {
          workspace: workspaceDir,
          memorySearch: {
            provider: "auto",
            store: { path: indexPath, vector: { enabled: false } },
            cache: { enabled: false },
            sync: { watch: false, onSessionStart: false, onSearch: false },
          },
        },
        list: [{ id: "main", default: true }],
      },
    } as CoreBlowConfig;

    const manager = await getRequiredMemoryIndexManager({ cfg, agentId: "main" });
    try {
      await manager.sync({ reason: "test-fts-only", force: true });
      const status = manager.status();
      expect(status.files).toBe(1);
      expect(status.chunks).toBeGreaterThan(0);

      const results = await manager.search("ORION-7741");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.path).toBe("MEMORY.md");
      expect(results[0]?.snippet).toContain("ORION-7741");
    } finally {
      await manager.close();
    }
  });
});
