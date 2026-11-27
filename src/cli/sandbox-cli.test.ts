import { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sandboxCloudCommand } from "../commands/sandbox-cloud.js";
import { sandboxListCommand } from "../commands/sandbox.js";
import { registerSandboxCli } from "./sandbox-cli.js";

describe("coreblow sandbox CLI", () => {
  const prevDaytona = process.env.DAYTONA_API_KEY;
  const prevE2b = process.env.E2B_API_KEY;

  afterEach(() => {
    if (prevDaytona === undefined) delete process.env.DAYTONA_API_KEY;
    else process.env.DAYTONA_API_KEY = prevDaytona;
    if (prevE2b === undefined) delete process.env.E2B_API_KEY;
    else process.env.E2B_API_KEY = prevE2b;
  });

  it("registers list, create, exec, pause, resume, destroy subcommands", () => {
    const program = new Command();
    registerSandboxCli(program);
    const sandboxCmd = program.commands.find((c) => c.name() === "sandbox");
    expect(sandboxCmd).toBeDefined();
    const names = sandboxCmd?.commands.map((c) => c.name()) ?? [];
    expect(names).toEqual(
      expect.arrayContaining(["list", "recreate", "explain", "create", "exec", "pause", "resume", "destroy"]),
    );
  });

  it("sandbox list --json includes backends status", async () => {
    const logs: string[] = [];
    const runtime = {
      log: vi.fn((msg: string) => logs.push(msg)),
      error: vi.fn(),
      exit: vi.fn(),
    };
    await sandboxListCommand({ browser: false, json: true }, runtime as never);
    const payload = JSON.parse(logs[0] ?? "{}");
    expect(Array.isArray(payload.containers)).toBe(true);
    expect(Array.isArray(payload.browsers)).toBe(true);
    expect(Array.isArray(payload.backends)).toBe(true);
    expect(payload.backends.some((b: { id: string }) => b.id === "daytona")).toBe(true);
    expect(payload.backends.some((b: { id: string }) => b.id === "e2b")).toBe(true);
  });

  it("fails closed on sandbox create when DAYTONA_API_KEY or E2B_API_KEY is missing", async () => {
    delete process.env.DAYTONA_API_KEY;
    delete process.env.E2B_API_KEY;
    const logs: string[] = [];
    const runtime = {
      log: vi.fn((msg: string) => logs.push(msg)),
      error: vi.fn(),
      exit: vi.fn(),
    };

    await sandboxCloudCommand("create", { backend: "daytona", json: true }, runtime as never);
    expect(runtime.exit).toHaveBeenCalledWith(1);
    expect(JSON.parse(logs[0] ?? "{}").error).toBe("DAYTONA_API_KEY_MISSING");
  });
});
