import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  maybeRecoverSuspiciousConfigRead,
  promoteConfigSnapshotToLastKnownGood,
  recoverConfigFromLastKnownGood,
  resolveLastKnownGoodConfigPath,
  type ObserveRecoveryDeps,
} from "./io.observe-recovery.js";

describe("config observe recovery", () => {
  let fixtureRoot = "";
  let caseId = 0;

  beforeAll(async () => {
    fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "coreblow-config-observe-"));
  });

  afterAll(async () => {
    await fsp.rm(fixtureRoot, { recursive: true, force: true });
  });

  async function withCase<T>(fn: (params: {
    home: string;
    configPath: string;
    deps: ObserveRecoveryDeps;
    warn: ReturnType<typeof vi.fn>;
  }) => Promise<T>): Promise<T> {
    const home = path.join(fixtureRoot, `case-${caseId++}`);
    const configPath = path.join(home, ".coreblow", "coreblow.json");
    const warn = vi.fn();
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    return await fn({
      home,
      configPath,
      warn,
      deps: {
        fs,
        json5: JSON,
        env: {} as NodeJS.ProcessEnv,
        homedir: () => home,
        logger: { warn },
      },
    });
  }

  it("promotes and restores last-known-good config snapshots", async () => {
    await withCase(async ({ configPath, deps }) => {
      const raw = `${JSON.stringify({ meta: { lastTouchedAt: "2026-06-06" }, gateway: { mode: "local" } })}\n`;
      await promoteConfigSnapshotToLastKnownGood({
        deps,
        snapshot: {
          path: configPath,
          raw,
          parsed: JSON.parse(raw),
          valid: true,
        },
      });

      expect(await fsp.readFile(resolveLastKnownGoodConfigPath(configPath), "utf-8")).toBe(raw);
      await fsp.writeFile(configPath, "{}\n", "utf-8");
      expect(await recoverConfigFromLastKnownGood({ deps, configPath })).toBe(raw);
      expect(await fsp.readFile(configPath, "utf-8")).toBe(raw);
    });
  });

  it("recovers update-channel-only reads from the backup and writes audit evidence", async () => {
    await withCase(async ({ home, configPath, deps, warn }) => {
      const healthyConfig = {
        meta: { lastTouchedAt: "2026-06-06T00:00:00.000Z" },
        gateway: { mode: "local" },
        channels: {
          telegram: {
            enabled: true,
            allowFrom: ["user-1", "user-2", "user-3", "user-4", "user-5", "user-6"],
          },
        },
      };
      const backupRaw = `${JSON.stringify(healthyConfig, null, 2)}\n`;
      await fsp.writeFile(configPath, backupRaw, "utf-8");
      await fsp.copyFile(configPath, `${configPath}.bak`);

      const clobbered = { update: { channel: "beta" } };
      const clobberedRaw = `${JSON.stringify(clobbered, null, 2)}\n`;
      await fsp.writeFile(configPath, clobberedRaw, "utf-8");

      const recovered = await maybeRecoverSuspiciousConfigRead({
        deps,
        configPath,
        raw: clobberedRaw,
        parsed: clobbered,
      });

      expect(recovered.raw).toBe(backupRaw);
      expect(await fsp.readFile(configPath, "utf-8")).toBe(backupRaw);
      expect(warn.mock.calls.join("\n")).toContain("Config observe recovery");
      expect((await fsp.readdir(path.dirname(configPath))).some((entry) => entry.includes(".clobbered."))).toBe(
        true,
      );

      const auditPath = path.join(home, ".coreblow", "logs", "config-audit.jsonl");
      const auditRaw = await fsp.readFile(auditPath, "utf-8");
      expect(auditRaw).toContain('"event":"config.observe"');
      expect(auditRaw).toContain("update-channel-only-root");
    });
  });
});
