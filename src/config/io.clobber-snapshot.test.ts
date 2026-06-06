import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CONFIG_CLOBBER_SNAPSHOT_LIMIT,
  persistBoundedClobberedConfigSnapshot,
  persistBoundedClobberedConfigSnapshotSync,
} from "./io.clobber-snapshot.js";

describe("config clobber snapshots", () => {
  let fixtureRoot = "";
  let caseId = 0;

  beforeAll(async () => {
    fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "coreblow-config-clobber-"));
  });

  afterAll(async () => {
    await fsp.rm(fixtureRoot, { recursive: true, force: true });
  });

  async function withCase<T>(fn: (configPath: string) => Promise<T>): Promise<T> {
    const home = path.join(fixtureRoot, `case-${caseId++}`);
    const configPath = path.join(home, ".coreblow", "coreblow.json");
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(configPath, "{}\n", "utf-8");
    return await fn(configPath);
  }

  async function clobberContents(configPath: string): Promise<string[]> {
    const dir = path.dirname(configPath);
    const prefix = `${path.basename(configPath)}.clobbered.`;
    const entries = (await fsp.readdir(dir)).filter((entry) => entry.startsWith(prefix));
    return await Promise.all(entries.map((entry) => fsp.readFile(path.join(dir, entry), "utf-8")));
  }

  it("rotates async snapshots under the per-path cap", async () => {
    await withCase(async (configPath) => {
      const warn = vi.fn();
      for (let index = 0; index < CONFIG_CLOBBER_SNAPSHOT_LIMIT + 3; index++) {
        await persistBoundedClobberedConfigSnapshot({
          deps: { fs, logger: { warn } },
          configPath,
          raw: `polluted-${index}\n`,
          observedAt: `2026-06-06T00:00:${String(index).padStart(2, "0")}.000Z`,
        });
      }

      const contents = await clobberContents(configPath);
      expect(contents).toHaveLength(CONFIG_CLOBBER_SNAPSHOT_LIMIT);
      expect(contents).not.toContain("polluted-0\n");
      expect(contents).toContain(`polluted-${CONFIG_CLOBBER_SNAPSHOT_LIMIT + 2}\n`);
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  it("writes sync snapshots with same-timestamp suffixes", async () => {
    await withCase(async (configPath) => {
      const warn = vi.fn();
      const first = persistBoundedClobberedConfigSnapshotSync({
        deps: { fs, logger: { warn } },
        configPath,
        raw: "first\n",
        observedAt: "2026-06-06T00:00:00.000Z",
      });
      const second = persistBoundedClobberedConfigSnapshotSync({
        deps: { fs, logger: { warn } },
        configPath,
        raw: "second\n",
        observedAt: "2026-06-06T00:00:00.000Z",
      });

      expect(first).not.toBe(second);
      expect(await clobberContents(configPath)).toEqual(["first\n", "second\n"]);
    });
  });
});
