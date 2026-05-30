import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const SCAN_ROOTS = ["src", "packages", "extensions"] as const;
const ALLOWED_PREFIXES = ["src/infra/", "src/plugin-sdk/", "packages/memory-host-sdk/"] as const;

function toRepoRelativePath(filePath: string): string {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join(path.posix.sep);
}

function isSourceFile(filePath: string): boolean {
  return filePath.endsWith(".ts") && !filePath.endsWith(".test.ts") && !filePath.endsWith(".d.ts");
}

function listSourceFiles(dir: string): string[] {
  return (
    listGitSourceFiles(toRepoRelativePath(dir)) ?? listFindSourceFiles(dir) ?? walkSourceFiles(dir)
  );
}

function listGitSourceFiles(repoPath: string): string[] | null {
  const result = spawnSync("git", ["ls-files", "--", repoPath], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => path.join(REPO_ROOT, filePath))
    .filter((filePath) => fs.existsSync(filePath))
    .filter(isSourceFile)
    .toSorted();
}

function listFindSourceFiles(dir: string): string[] | null {
  const result = spawnSync("find", [dir, "-type", "f", "-name", "*.ts"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(isSourceFile)
    .toSorted();
}

function walkSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...walkSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && isSourceFile(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function expectNoReaddirSyncDuring(run: () => void): void {
  const spy = vi.spyOn(fs, "readdirSync");
  try {
    run();
    expect(spy).not.toHaveBeenCalled();
  } finally {
    spy.mockRestore();
  }
}

function importsFsSafePackage(source: string): boolean {
  return (
    source.includes('"@openclaw/fs-safe') ||
    source.includes("'@openclaw/fs-safe") ||
    source.includes('"@coreblow/fs-safe') ||
    source.includes("'@coreblow/fs-safe")
  );
}

describe("fs-safe import boundary", () => {
  it("lists source files without scanning boundary roots in-process", () => {
    expectNoReaddirSyncDuring(() => {
      const files = SCAN_ROOTS.flatMap((root) => listSourceFiles(path.join(REPO_ROOT, root)));

      expect(files.length).toBeGreaterThan(0);
      expect(files.every(isSourceFile)).toBe(true);
    });
  });

  it("keeps direct fs-safe package imports behind CoreBlow policy wrappers", () => {
    const violations = SCAN_ROOTS.flatMap((root) => listSourceFiles(path.join(REPO_ROOT, root)))
      .map((filePath) => toRepoRelativePath(filePath))
      .filter((filePath) => {
        if (ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix))) {
          return false;
        }
        const source = fs.readFileSync(path.join(REPO_ROOT, filePath), "utf8");
        return importsFsSafePackage(source);
      });

    expect(violations).toStrictEqual([]);
  });
});
