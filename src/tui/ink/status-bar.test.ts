import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "ink";
import {
  buildProgressBar,
  calculateContextMetrics,
  formatTokenCount,
  getContextColor,
} from "./context-telemetry.js";
import { StatusBar } from "./StatusBar.js";
import { inkPalette } from "./theme.js";

describe("StatusBar & Context Telemetry", () => {
  describe("Context color thresholds", () => {
    it("returns green for usage < 50%", () => {
      expect(getContextColor(0)).toBe(inkPalette.success);
      expect(getContextColor(25)).toBe(inkPalette.success);
      expect(getContextColor(49)).toBe(inkPalette.success);
    });

    it("returns yellow for usage between 50% and 79%", () => {
      expect(getContextColor(50)).toBe(inkPalette.accent);
      expect(getContextColor(65)).toBe(inkPalette.accent);
      expect(getContextColor(79)).toBe(inkPalette.accent);
    });

    it("returns orange for usage between 80% and 94%", () => {
      expect(getContextColor(80)).toBe(inkPalette.accentSoft);
      expect(getContextColor(90)).toBe(inkPalette.accentSoft);
      expect(getContextColor(94)).toBe(inkPalette.accentSoft);
    });

    it("returns red for usage >= 95%", () => {
      expect(getContextColor(95)).toBe(inkPalette.error);
      expect(getContextColor(100)).toBe(inkPalette.error);
      expect(getContextColor(120)).toBe(inkPalette.error);
    });
  });

  describe("buildProgressBar", () => {
    it("renders empty bar at 0%", () => {
      expect(buildProgressBar(0, 8)).toBe("[░░░░░░░░]");
    });

    it("renders half filled bar at 50%", () => {
      expect(buildProgressBar(50, 8)).toBe("[████░░░░]");
    });

    it("renders full bar at 100%", () => {
      expect(buildProgressBar(100, 8)).toBe("[████████]");
    });
  });

  describe("formatTokenCount", () => {
    it("formats thousands as K", () => {
      expect(formatTokenCount(12000)).toBe("12K");
      expect(formatTokenCount(12400)).toBe("12.4K");
      expect(formatTokenCount(200000)).toBe("200K");
    });

    it("formats millions as M", () => {
      expect(formatTokenCount(1500000)).toBe("1.5M");
    });

    it("formats small numbers directly", () => {
      expect(formatTokenCount(450)).toBe("450");
    });
  });

  describe("calculateContextMetrics", () => {
    it("computes accurate percentage and cost", () => {
      const res = calculateContextMetrics({
        usedTokens: 20_000,
        maxTokens: 200_000,
        provider: "anthropic",
      });

      expect(res.percentage).toBe(10);
      expect(res.formattedUsed).toBe("20K");
      expect(res.formattedMax).toBe("200K");
      expect(res.color).toBe(inkPalette.success);
      expect(res.costUsd).toBeGreaterThan(0);
    });
  });

  describe("StatusBar 3-tier responsive layout", () => {
    it("renders full layout when columns >= 80", () => {
      const output = renderToString(
        React.createElement(StatusBar, {
          model: "anthropic/claude-3-7-sonnet",
          permissionMode: "manual",
          backendBadge: "Local",
          usedTokens: 12000,
          maxTokens: 200000,
          columns: 100,
        }),
      );

      expect(output).toContain("anthropic/claude-3-7-sonnet");
      expect(output).toContain("[manual]");
      expect(output).toContain("12K/200K");
      expect(output).toContain("Local");
    });

    it("renders compact layout when columns are between 56 and 79", () => {
      const output = renderToString(
        React.createElement(StatusBar, {
          model: "anthropic/claude-3-7-sonnet",
          permissionMode: "auto",
          backendBadge: "Gateway :18789",
          usedTokens: 12000,
          maxTokens: 200000,
          columns: 70,
        }),
      );

      // Model name is shortened to claude-3-7-sonnet
      expect(output).toContain("claude-3-7-sonnet");
      expect(output).toContain("[auto]");
      expect(output).toContain("6%");
      // Full tokens like 12K/200K are omitted in compact tier
      expect(output).not.toContain("12K/200K");
    });

    it("renders minimal layout when columns < 56", () => {
      const output = renderToString(
        React.createElement(StatusBar, {
          model: "anthropic/claude-3-7-sonnet",
          permissionMode: "manual",
          backendBadge: "Local",
          usedTokens: 12000,
          maxTokens: 200000,
          columns: 45,
        }),
      );

      expect(output).toContain("claude-3-7-sonnet");
      expect(output).toContain("6%");
      // Mode badge and cost are omitted in minimal tier
      expect(output).not.toContain("[manual]");
      expect(output).not.toContain("$");
    });
  });
});
