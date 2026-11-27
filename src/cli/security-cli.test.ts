import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultRuntime } from "../runtime.js";
import { registerSecurityCli } from "./security-cli.js";

describe("security rbac CLI --json output", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.COREBLOW_STATE_DIR;
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("writes pure JSON via defaultRuntime.writeJson without banner or log pollution", async () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-rbac-cli-test-"));
    tempDirs.push(stateDir);
    process.env.COREBLOW_STATE_DIR = stateDir;

    const writeJsonSpy = vi.spyOn(defaultRuntime, "writeJson").mockImplementation(() => {});
    const logSpy = vi.spyOn(defaultRuntime, "log").mockImplementation(() => {});

    const program = new Command();
    registerSecurityCli(program);

    await program.parseAsync(["security", "rbac", "list", "--json"], { from: "user" });
    expect(logSpy).not.toHaveBeenCalled();
    expect(writeJsonSpy).toHaveBeenCalledTimes(1);
    const listPayload = writeJsonSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(listPayload.bootstrapMode).toBe("single-user-local");
    expect(Array.isArray(listPayload.roles)).toBe(true);
    expect(Array.isArray(listPayload.bindings)).toBe(true);

    writeJsonSpy.mockClear();
    await program.parseAsync(
      ["security", "rbac", "grant", "--principal", "qc-tester", "--role", "operator", "--json"],
      { from: "user" },
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(writeJsonSpy).toHaveBeenCalledTimes(1);
    const grantPayload = writeJsonSpy.mock.calls[0]?.[0] as {
      ok: boolean;
      binding: { principalId: string; roleName: string };
    };
    expect(grantPayload.ok).toBe(true);
    expect(grantPayload.binding.principalId).toBe("qc-tester");
    expect(grantPayload.binding.roleName).toBe("operator");

    writeJsonSpy.mockClear();
    await program.parseAsync(
      ["security", "rbac", "revoke", "--principal", "qc-tester", "--role", "operator", "--json"],
      { from: "user" },
    );
    expect(logSpy).not.toHaveBeenCalled();
    expect(writeJsonSpy).toHaveBeenCalledTimes(1);
    const revokePayload = writeJsonSpy.mock.calls[0]?.[0] as {
      ok: boolean;
      revoked: boolean;
      principalId: string;
      roleName: string;
    };
    expect(revokePayload).toEqual({
      ok: true,
      revoked: true,
      principalId: "qc-tester",
      roleName: "operator",
    });
  });
});
