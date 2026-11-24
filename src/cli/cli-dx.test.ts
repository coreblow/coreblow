import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import {
  buildChildEnv,
  forwardSignalsToChild,
  resolveTsxBin,
  resolveTsxEsmUrl,
} from "../../coreblow.mjs";
import { launchDesktopApp } from "./desktop-cli.js";
import { handleSlashCommand, runOneShotCliQuery } from "./interactive-chat.js";
import { SUB_CLI_DESCRIPTORS } from "./program/subcli-descriptors.js";
import { registerTuiCli } from "./tui-cli.js";

describe("coreblow.mjs environment", () => {
  it("injects --disable-warning=DEP0040 into NODE_OPTIONS when unset", () => {
    const childEnv = buildChildEnv({});
    expect(childEnv.NODE_OPTIONS).toBe("--disable-warning=DEP0040");
  });

  it("appends --disable-warning=DEP0040 to existing NODE_OPTIONS", () => {
    const childEnv = buildChildEnv({ NODE_OPTIONS: "--max-old-space-size=4096" });
    expect(childEnv.NODE_OPTIONS).toBe("--max-old-space-size=4096 --disable-warning=DEP0040");
  });

  it("does not duplicate if DEP0040 is already present", () => {
    const childEnv = buildChildEnv({ NODE_OPTIONS: "--disable-warning=DEP0040" });
    expect(childEnv.NODE_OPTIONS).toBe("--disable-warning=DEP0040");
  });

  it("does not append if --no-deprecation is present", () => {
    const childEnv = buildChildEnv({ NODE_OPTIONS: "--no-deprecation" });
    expect(childEnv.NODE_OPTIONS).toBe("--no-deprecation");
  });

  it("forwards SIGTERM and SIGINT to running child and cleans up listeners on exit", () => {
    class MockChild extends EventEmitter {
      killed = false;
      exitCode: number | null = null;
      signalCode: string | null = null;
      kill = vi.fn((sig: string) => {
        this.killed = true;
        this.signalCode = sig;
        return true;
      });
    }

    const child = new MockChild();
    const sigtermListenersBefore = process.listeners("SIGTERM").length;
    const sigintListenersBefore = process.listeners("SIGINT").length;

    const cleanup = forwardSignalsToChild(child as any);

    expect(process.listeners("SIGTERM").length).toBe(sigtermListenersBefore + 1);
    expect(process.listeners("SIGINT").length).toBe(sigintListenersBefore + 1);

    // Emit SIGTERM on process
    process.emit("SIGTERM", "SIGTERM");
    expect(child.kill).toHaveBeenCalledWith("SIGTERM");

    // Clean up via child exit
    child.emit("exit", 0, null);

    expect(process.listeners("SIGTERM").length).toBe(sigtermListenersBefore);
    expect(process.listeners("SIGINT").length).toBe(sigintListenersBefore);

    cleanup();
  });

  it("cleans up signal listeners on child error", () => {
    class MockChild extends EventEmitter {
      killed = false;
      exitCode: number | null = null;
      signalCode: string | null = null;
      kill = vi.fn();
    }

    const child = new MockChild();
    const sigtermListenersBefore = process.listeners("SIGTERM").length;
    const sigintListenersBefore = process.listeners("SIGINT").length;

    forwardSignalsToChild(child as any);

    expect(process.listeners("SIGTERM").length).toBe(sigtermListenersBefore + 1);
    expect(process.listeners("SIGINT").length).toBe(sigintListenersBefore + 1);

    child.emit("error", new Error("spawn failed"));

    expect(process.listeners("SIGTERM").length).toBe(sigtermListenersBefore);
    expect(process.listeners("SIGINT").length).toBe(sigintListenersBefore);
  });

  it("resolves an absolute file URL for tsx/esm (not a bare specifier)", () => {
    const url = resolveTsxEsmUrl("tsx/esm");
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^file:\/\/.+\/tsx\/.+/);
    expect(url).not.toBe("tsx/esm");
  });

  it("resolves local node_modules/.bin/tsx when present", () => {
    const bin = resolveTsxBin(process.cwd());
    expect(bin).toBeDefined();
    expect(bin).toContain(".bin");
    expect(bin).toContain("tsx");
  });

  it("resolves hoisted parent ../.bin/tsx when local node_modules/.bin/tsx is absent", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-hoisted-test-"));
    try {
      const hoistedBinDir = path.join(tempDir, ".bin");
      fs.mkdirSync(hoistedBinDir, { recursive: true });
      const hoistedTsx = path.join(hoistedBinDir, "tsx");
      fs.writeFileSync(hoistedTsx, "#!/bin/sh\necho tsx\n", { mode: 0o755 });

      const subPkgDir = path.join(tempDir, "coreblow");
      fs.mkdirSync(subPkgDir, { recursive: true });

      const resolved = resolveTsxBin(subPkgDir);
      expect(resolved).toBe(hoistedTsx);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("desktop subcommand", () => {
  it("registers desktop in SUB_CLI_DESCRIPTORS", () => {
    const desktopDescriptor = SUB_CLI_DESCRIPTORS.find((d) => d.name === "desktop");
    expect(desktopDescriptor).toBeDefined();
    expect(desktopDescriptor?.hasSubcommands).toBe(false);
    expect(desktopDescriptor?.description).toContain("CoreBlow Studio desktop");
  });

  it("launches desktop app with detached process and session handoff", () => {
    const unref = vi.fn();
    const spawnFn = vi.fn().mockReturnValue({ unref });

    const result = launchDesktopApp({
      platform: "darwin",
      spawnFn: spawnFn as unknown as typeof import("node:child_process").spawn,
      existsFn: () => true,
      repoRoot: "/test/repo",
      sessionId: "session-handoff-123",
    });

    expect(result).toBeDefined();
    expect(typeof result.launched).toBe("boolean");
    expect(typeof result.strategy).toBe("string");
    expect(spawnFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          COREBLOW_SESSION_ID: "session-handoff-123",
        }),
      }),
    );
  });
});

describe("interactive chat slash commands", () => {
  it("parses /help command", async () => {
    const res = await handleSlashCommand("/help");
    expect(res.handled).toBe(true);
    expect(res.output).toContain("/rollback");
    expect(res.output).toContain("/exit");
  });

  it("parses /exit and /quit commands", async () => {
    const resExit = await handleSlashCommand("/exit");
    expect(resExit.handled).toBe(true);
    expect(resExit.shouldExit).toBe(true);

    const resQuit = await handleSlashCommand("/quit");
    expect(resQuit.handled).toBe(true);
    expect(resQuit.shouldExit).toBe(true);
  });

  it("parses /clear command and triggers session reset", async () => {
    const onReset = vi.fn();
    const res = await handleSlashCommand("/clear", { onResetSession: onReset });
    expect(res.handled).toBe(true);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(res.output).toContain("fresh session");
  });

  it("parses /rollback command and queries checkpoint manager", async () => {
    const res = await handleSlashCommand("/rollback");
    expect(res.handled).toBe(true);
    expect(res.output).toBeDefined();
  });

  it("rejects non-slash user prompt", async () => {
    const res = await handleSlashCommand("halo apa kabar");
    expect(res.handled).toBe(false);
  });
});

describe("runOneShotCliQuery", () => {
  it("queries gateway endpoint and returns reply", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reply: "halo dari gateway" }),
    });

    const reply = await runOneShotCliQuery("cek status", {
      fetchFn: mockFetch as unknown as typeof fetch,
      exitProcess: false,
    });

    expect(reply).toBe("halo dari gateway");
    expect(mockFetch).toHaveBeenCalledWith(
      "http://127.0.0.1:18789/api/corehub/chat/react",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("tui command options", () => {
  it("registers --local option on tui command", () => {
    const program = new Command();
    registerTuiCli(program);
    const tuiCmd = program.commands.find((c) => c.name() === "tui");
    expect(tuiCmd).toBeDefined();
    const localOption = tuiCmd?.options.find((o) => o.attributeName() === "local");
    expect(localOption).toBeDefined();
    expect(localOption?.long).toBe("--local");
  });
});
