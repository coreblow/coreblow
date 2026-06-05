import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSessionEntry } from "./session-files.js";

describe("buildSessionEntry responsiveness", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "session-yield-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("yields while parsing a single large transcript", async () => {
    const filePath = path.join(tmpDir, "session.jsonl");
    await fs.writeFile(
      filePath,
      Array.from({ length: 25 }, (_value, index) =>
        JSON.stringify({
          type: "message",
          message: { role: "user", content: `message ${index}` },
        }),
      ).join("\n"),
    );
    let immediateRan = false;
    const immediate = new Promise<void>((resolve) => {
      setImmediate(() => {
        immediateRan = true;
        resolve();
      });
    });

    const entry = await buildSessionEntry(filePath, { parseYieldEveryLines: 10 });

    expect(entry?.lineMap).toHaveLength(25);
    expect(immediateRan).toBe(true);
    await immediate;
  });
});
