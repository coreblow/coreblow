import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readMemoryFile } from "./read-file.js";

describe("readMemoryFile", () => {
  let tmpDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-read-file-"));
    workspaceDir = path.join(tmpDir, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty content for missing markdown files under extra paths", async () => {
    const extraDir = path.join(tmpDir, "extra");
    await fs.mkdir(extraDir);
    const target = path.join(extraDir, "missing.md");

    const result = await readMemoryFile({
      workspaceDir,
      extraPaths: [extraDir],
      relPath: target,
    });

    expect(result.text).toBe("");
    expect(result.path).toContain("missing.md");
  });

  it("rejects extra path reads through symlinked directory components", async () => {
    const extraDir = path.join(tmpDir, "extra");
    const outsideDir = path.join(tmpDir, "outside");
    await fs.mkdir(extraDir);
    await fs.mkdir(outsideDir);
    await fs.writeFile(path.join(outsideDir, "secret.md"), "secret");
    await fs.symlink(outsideDir, path.join(extraDir, "link"));

    await expect(
      readMemoryFile({
        workspaceDir,
        extraPaths: [extraDir],
        relPath: path.join(extraDir, "link", "secret.md"),
      }),
    ).rejects.toThrow("path required");
  });
});
