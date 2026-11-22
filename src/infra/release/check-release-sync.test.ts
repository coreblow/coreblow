import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const scriptPath = path.join(repoRoot, "scripts/check-release-sync.mjs");

describe("check-release-sync contract gate", () => {
  it("passes cleanly on the current repo state", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: { ...process.env, CI: "true" },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Release-sync contract verified for CoreBlow");
    expect(result.stderr).toBe("");
  });
});
