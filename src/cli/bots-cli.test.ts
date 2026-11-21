import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  getBotChannelsStatus,
  setChannelEnabled,
  registerBotsCli,
} from "./bots-cli.js";
import { parseHeadlessArgs } from "./headless-runner.js";

describe("bots-cli & execution backend flags", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-bots-test-"));
    process.env.COREBLOW_STATE_DIR = tempDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe("getBotChannelsStatus", () => {
    it("returns status for all standard channels with loop protection fields", async () => {
      const statuses = await getBotChannelsStatus();
      expect(statuses.length).toBeGreaterThanOrEqual(5);

      const ids = statuses.map((s) => s.id);
      expect(ids).toContain("telegram");
      expect(ids).toContain("discord");
      expect(ids).toContain("slack");
      expect(ids).toContain("whatsapp");
      expect(ids).toContain("signal");

      for (const s of statuses) {
        expect(["active", "inactive"]).toContain(s.loopProtection);
        expect(["online", "pairing", "offline", "error"]).toContain(s.status);
      }
    });
  });

  describe("setChannelEnabled", () => {
    it("updates channel enabled flag in config", async () => {
      const ok = await setChannelEnabled("telegram", true);
      expect(ok).toBe(true);

      const statuses = await getBotChannelsStatus();
      const tg = statuses.find((s) => s.id === "telegram");
      expect(tg?.enabled).toBe(true);
      expect(tg?.loopProtection).toBe("active");
    });

    it("rejects unknown channel ids", async () => {
      await expect(setChannelEnabled("unknown-bot-channel", true)).rejects.toThrow(
        'Unknown channel "unknown-bot-channel"',
      );
    });
  });

  describe("registerBotsCli", () => {
    it("registers bots command and subcommands on program", () => {
      const program = new Command();
      registerBotsCli(program);

      const botsCmd = program.commands.find((c) => c.name() === "bots");
      expect(botsCmd).toBeDefined();

      const subNames = botsCmd?.commands.map((c) => c.name());
      expect(subNames).toContain("status");
      expect(subNames).toContain("enable");
      expect(subNames).toContain("disable");
      expect(subNames).toContain("pair");
      expect(subNames).toContain("test");
    });
  });

  describe("headless-runner --backend and --backend-target flags", () => {
    it("parses --backend and --backend-target cleanly from argv", () => {
      const argv = [
        "node",
        "coreblow",
        "-p",
        "check",
        "--backend",
        "docker",
        "--backend-target",
        "node:22-slim",
      ];
      const parsed = parseHeadlessArgs(argv);
      expect(parsed.backend).toBe("docker");
      expect(parsed.backendTarget).toBe("node:22-slim");
    });

    it("parses ssh backend target", () => {
      const argv = [
        "node",
        "coreblow",
        "-p",
        "uptime",
        "--backend",
        "ssh",
        "--backend-target",
        "deploy@server1.local",
      ];
      const parsed = parseHeadlessArgs(argv);
      expect(parsed.backend).toBe("ssh");
      expect(parsed.backendTarget).toBe("deploy@server1.local");
    });
  });
});
