import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportTrajectoryBundle } from "./export.js";

describe("exportTrajectoryBundle", () => {
  it("exports a CoreBlow trajectory bundle from session jsonl", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-trajectory-export-"));
    const sessionFile = path.join(dir, "session.jsonl");
    const outputDir = path.join(dir, "bundle");
    fs.writeFileSync(
      sessionFile,
      `${JSON.stringify({ type: "session", id: "session-1", version: 2 })}\n`,
    );

    const manifest = await exportTrajectoryBundle({
      outputDir,
      sessionFile,
      sessionId: "session-1",
      workspaceDir: dir,
    });

    expect(manifest.manifest.traceSchema).toBe("coreblow-trajectory");
    expect(fs.existsSync(path.join(outputDir, "manifest.json"))).toBe(true);
  });
});
