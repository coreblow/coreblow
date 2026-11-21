import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "ink";
import { filterSlashCommands } from "./input-prefixes.js";
import { formatBackendBadge } from "../../execution/execution-backend.js";
import { StatusBar } from "./StatusBar.js";
import { BackendModal } from "./BackendModal.js";
import { BotsModal } from "./BotsModal.js";
import { CronModal } from "./CronModal.js";

describe("cron-bots-backend TUI integration", () => {
  describe("Slash command registration", () => {
    it("includes /cron and /schedule aliases in slash commands", () => {
      const all = filterSlashCommands("/");
      expect(all.some((c) => c.cmd === "/cron")).toBe(true);
      expect(all.some((c) => c.cmd === "/schedule")).toBe(true);
    });

    it("includes /bots and /channels aliases in slash commands", () => {
      const all = filterSlashCommands("/");
      expect(all.some((c) => c.cmd === "/bots")).toBe(true);
      expect(all.some((c) => c.cmd === "/channels")).toBe(true);
    });

    it("includes /backend in slash commands", () => {
      const all = filterSlashCommands("/");
      expect(all.some((c) => c.cmd === "/backend")).toBe(true);
    });

    it("filters /cro to /cron", () => {
      const matches = filterSlashCommands("/cro");
      expect(matches.length).toBe(1);
      expect(matches[0]?.cmd).toBe("/cron");
    });
  });

  describe("StatusBar backend badge reflection", () => {
    it("renders custom execution backend badge in StatusBar", () => {
      const output = renderToString(
        React.createElement(StatusBar, {
          model: "openai/gpt-4o",
          permissionMode: "auto",
          backendBadge: "Docker:node:22-slim",
          usedTokens: 5000,
          maxTokens: 128000,
          columns: 90,
        }),
      );

      expect(output).toContain("gpt-4o");
      expect(output).toContain("[auto]");
      expect(output).toContain("Docker:node:22-slim");
    });

    it("renders SSH backend badge in StatusBar", () => {
      const output = renderToString(
        React.createElement(StatusBar, {
          model: "anthropic/claude-3-7-sonnet",
          permissionMode: "manual",
          backendBadge: "SSH:prod-box",
          usedTokens: 10000,
          maxTokens: 200000,
          columns: 90,
        }),
      );

      expect(output).toContain("claude-3-7-sonnet");
      expect(output).toContain("SSH:prod-box");
    });
  });

  describe("BackendModal rendering", () => {
    it("renders list of all 6 execution backends", () => {
      const output = renderToString(
        React.createElement(BackendModal, {
          currentConfig: { type: "local" },
          onSelectBackend: vi.fn(),
          onClose: vi.fn(),
        }),
      );

      expect(output).toContain("CoreBlow Execution Backends");
      expect(output).toContain("Local Host Shell");
      expect(output).toContain("OS-Level Sandbox");
      expect(output).toContain("Docker Container");
      expect(output).toContain("Remote SSH Host");
      expect(output).toContain("CoreBlow Paired Remote Node");
      expect(output).toContain("Remote Cloud Sandbox");
    });
  });

  describe("BotsModal rendering", () => {
    it("renders bot messaging channels and gateway status", () => {
      const output = renderToString(
        React.createElement(BotsModal, {
          onClose: vi.fn(),
        }),
      );

      expect(output).toContain("CoreBlow 24/7 Bot Messaging & Gateway");
      expect(output).toContain("Gateway :18789");
      expect(output).toContain("Telegram");
      expect(output).toContain("Discord");
      expect(output).toContain("Slack");
      expect(output).toContain("WhatsApp");
      expect(output).toContain("Signal");
    });
  });

  describe("CronModal rendering", () => {
    it("renders 24/7 cron orchestrator header and action shortcuts", () => {
      const output = renderToString(
        React.createElement(CronModal, {
          onClose: vi.fn(),
        }),
      );

      expect(output).toContain("CoreBlow 24/7 Cron Orchestrator");
      expect(output).toContain("Pause/Resume");
      expect(output).toContain("Run Now");
      expect(output).toContain("New");
    });
  });
});
