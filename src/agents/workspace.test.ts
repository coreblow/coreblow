import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeTempWorkspace, writeWorkspaceFile } from "../test-helpers/workspace.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
  ensureAgentWorkspace,
  loadWorkspaceBootstrapFiles,
  resolveDefaultAgentWorkspaceDir,
} from "./workspace.js";

const tempDirs: string[] = [];

describe("workspace", () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  it("exports expected default filenames", () => {
    expect(DEFAULT_AGENTS_FILENAME).toBe("AGENTS.md");
    expect(DEFAULT_IDENTITY_FILENAME).toBe("IDENTITY.md");
    expect(DEFAULT_TOOLS_FILENAME).toBe("TOOLS.md");
    expect(DEFAULT_USER_FILENAME).toBe("USER.md");
    expect(DEFAULT_BOOTSTRAP_FILENAME).toBe("BOOTSTRAP.md");
    expect(DEFAULT_MEMORY_FILENAME).toBe("MEMORY.md");
  });

  it("resolves default workspace directory", () => {
    const dir = resolveDefaultAgentWorkspaceDir();
    expect(typeof dir).toBe("string");
    expect(dir.length).toBeGreaterThan(0);
  });

  it("creates workspace directory in temp location", async () => {
    const dir = await makeTempWorkspace();
    tempDirs.push(dir);
    await ensureAgentWorkspace({ dir });

    const exists = await fs.stat(dir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it("writes and reads workspace files", async () => {
    const dir = await makeTempWorkspace();
    tempDirs.push(dir);

    await writeWorkspaceFile({ dir, name: "TEST.md", content: "# Test\n" });
    const content = await fs.readFile(path.join(dir, "TEST.md"), "utf-8");
    expect(content).toBe("# Test\n");
  });

  it("loads bootstrap files from workspace", async () => {
    const dir = await makeTempWorkspace();
    tempDirs.push(dir);
    await ensureAgentWorkspace({ dir });

    const files = await loadWorkspaceBootstrapFiles(dir);
    expect(Array.isArray(files)).toBe(true);
  });
});
