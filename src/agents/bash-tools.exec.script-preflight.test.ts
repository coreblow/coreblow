import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createExecTool } from "./bash-tools.exec.js";

const isWin = process.platform === "win32";
const describeNonWin = isWin ? describe.skip : describe;

describeNonWin("exec script preflight", () => {
  async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
    const { mkdtemp, rm } = fs;
    const { tmpdir } = await import("node:os");
    const dir = await mkdtemp(path.join(tmpdir(), prefix));
    try {
      return await fn(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("blocks shell env var injection tokens in python scripts before execution", async () => {
    await withTempDir("coreblow-exec-preflight-", async (tmp) => {
      const pyPath = path.join(tmp, "bad.py");

      await fs.writeFile(
        pyPath,
        [
          "import json",
          "# model accidentally wrote shell syntax:",
          "payload = $DM_JSON",
          "print(payload)",
        ].join("\n"),
        "utf-8",
      );

      const tool = createExecTool({ security: "full", ask: "off" });

      await expect(
        tool.execute("call1", {
          command: "python bad.py",
          workdir: tmp,
        }),
      ).rejects.toThrow(/shell variable injection|preflight/i);
    });
  });

  it("blocks obvious shell-as-js output before node execution", async () => {
    await withTempDir("coreblow-exec-preflight-js-", async (tmp) => {
      const jsPath = path.join(tmp, "bad.js");

      await fs.writeFile(
        jsPath,
        ['NODE "$TMPDIR/hot.json"', "console.log('hi')"].join("\n"),
        "utf-8",
      );

      const tool = createExecTool({ security: "full", ask: "off" });

      await expect(
        tool.execute("call1", {
          command: "node bad.js",
          workdir: tmp,
        }),
      ).rejects.toThrow(/preflight|shell variable|shell syntax/i);
    });
  });
});
