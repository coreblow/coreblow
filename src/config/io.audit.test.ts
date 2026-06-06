import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appendConfigAuditRecord,
  createConfigWriteAuditRecordBase,
  finalizeConfigWriteAuditRecord,
  formatConfigOverwriteLogMessage,
  redactConfigAuditArgv,
  resolveConfigAuditLogPath,
  scrubConfigAuditLog,
} from "./io.audit.js";

describe("config io audit helpers", () => {
  let fixtureRoot = "";

  beforeAll(async () => {
    fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "coreblow-config-audit-"));
  });

  afterAll(async () => {
    await fsp.rm(fixtureRoot, { recursive: true, force: true });
  });

  function createBase(configPath: string) {
    return createConfigWriteAuditRecordBase({
      configPath,
      env: {
        COREBLOW_WATCH_MODE: "1",
        COREBLOW_WATCH_SESSION: "watch-session",
        COREBLOW_WATCH_COMMAND: "gateway --force",
      } as NodeJS.ProcessEnv,
      existsBefore: true,
      previousHash: "prev-hash",
      nextHash: "next-hash",
      previousBytes: 12,
      nextBytes: 24,
      previousMetadata: {
        dev: "10",
        ino: "11",
        mode: 0o600,
        nlink: 1,
        uid: 501,
        gid: 20,
      },
      changedPathCount: 2,
      hasMetaBefore: false,
      hasMetaAfter: true,
      gatewayModeBefore: null,
      gatewayModeAfter: "local",
      suspicious: ["missing-meta-before-write"],
      now: "2026-06-06T00:00:00.000Z",
      processInfo: {
        pid: 101,
        ppid: 99,
        cwd: "/work",
        argv: ["node", "coreblow", "--gateway-token", "secret-token"],
        execArgv: ["--api-key=secret-key"],
      },
    });
  }

  it("redacts secret argv forms", () => {
    expect(
      redactConfigAuditArgv([
        "coreblow",
        "--gateway-token",
        "secret-token",
        "--custom-api-key=secret-key",
        "COREBLOW_GATEWAY_PASSWORD=password",
      ]),
    ).toEqual([
      "coreblow",
      "--gateway-token",
      "***",
      "--custom-api-key=***",
      "COREBLOW_GATEWAY_PASSWORD=***",
    ]);
  });

  it("creates CoreBlow watch audit records", () => {
    const record = finalizeConfigWriteAuditRecord({
      base: createBase("/tmp/coreblow.json"),
      result: "rename",
      nextMetadata: {
        dev: "12",
        ino: "13",
        mode: 0o600,
        nlink: 1,
        uid: 501,
        gid: 20,
      },
    });

    expect(record.watchMode).toBe(true);
    expect(record.watchSession).toBe("watch-session");
    expect(record.watchCommand).toBe("gateway --force");
    expect(record.argv).toEqual(["node", "coreblow", "--gateway-token", "***"]);
    expect(record.execArgv).toEqual(["--api-key=***"]);
    expect(record.nextDev).toBe("12");
  });

  it("formats overwrite messages", () => {
    expect(
      formatConfigOverwriteLogMessage({
        configPath: "/tmp/coreblow.json",
        previousHash: "prev-hash",
        nextHash: "next-hash",
        changedPathCount: 3,
      }),
    ).toBe(
      "Config overwrite: /tmp/coreblow.json (sha256 prev-hash -> next-hash, backup=/tmp/coreblow.json.bak, changedPaths=3)",
    );
  });

  it("appends and scrubs config audit logs", async () => {
    const home = path.join(fixtureRoot, "home");
    const record = finalizeConfigWriteAuditRecord({
      base: createBase(path.join(home, ".coreblow", "coreblow.json")),
      result: "rename",
      nextMetadata: {
        dev: "12",
        ino: "13",
        mode: 0o600,
        nlink: 1,
        uid: 501,
        gid: 20,
      },
    });

    await appendConfigAuditRecord({
      fs,
      env: {} as NodeJS.ProcessEnv,
      homedir: () => home,
      record,
    });

    const auditPath = resolveConfigAuditLogPath({} as NodeJS.ProcessEnv, () => home);
    const appended = JSON.parse((await fsp.readFile(auditPath, "utf-8")).trim()) as {
      argv: string[];
    };
    expect(appended.argv).toContain("***");

    await fsp.appendFile(
      auditPath,
      `${JSON.stringify({ event: "config.write", argv: ["--password", "plaintext"], execArgv: [] })}\n`,
      "utf-8",
    );
    const scrubbed = await scrubConfigAuditLog({
      fs,
      env: {} as NodeJS.ProcessEnv,
      homedir: () => home,
    });

    expect(scrubbed.rewritten).toBe(1);
    expect(await fsp.readFile(auditPath, "utf-8")).toContain('"***"');
  });
});
