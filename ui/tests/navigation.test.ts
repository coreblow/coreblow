import { describe, it, expect } from "vitest";
import { TAB_GROUPS, iconForTab, titleForTab } from "../src/ui/navigation.ts";
import type { Tab } from "../src/ui/types.ts";

describe("navigation utils", () => {
  it("returns correct icons for known tabs including channels, models, and mcp", () => {
    expect(iconForTab("chat")).toBe("messageSquare");
    expect(iconForTab("overview")).toBe("barChart");
    expect(iconForTab("sessions")).toBe("fileText");
    expect(iconForTab("channels")).toBe("radio");
    expect(iconForTab("models")).toBe("spark");
    expect(iconForTab("mcp")).toBe("puzzle");
    expect(iconForTab("coreHub")).toBe("package");
    expect(iconForTab("config")).toBe("settings");
    expect(iconForTab("usage")).toBe("activity");
    expect(iconForTab("cron")).toBe("clock");
    expect(iconForTab("aiAgents")).toBe("brain");
    expect(iconForTab("skills")).toBe("zap");
    expect(iconForTab("debug")).toBe("bug");
    expect(iconForTab("logs")).toBe("scrollText");
  });

  it("returns fallback icon for unknown tab", () => {
    expect(iconForTab("unknown_tab" as any)).toBe("folder");
  });

  it("returns correct titles for all tabs", () => {
    expect(titleForTab("channels")).toBe("Channels");
    expect(titleForTab("models")).toBe("Models");
    expect(titleForTab("mcp")).toBe("MCP");
    expect(titleForTab("aiAgents")).toBe("AI Agents");
    expect(titleForTab("cron")).toBe("Cron Jobs");
    expect(titleForTab("coreHub")).toBe("CoreHub");
  });

  it("returns raw tab name as fallback for unknown tab", () => {
    expect(titleForTab("unknown_tab" as any)).toBe("unknown_tab");
  });

  it("contains all 14 tabs in TAB_GROUPS in exact logical order", () => {
    const allTabs = TAB_GROUPS.flatMap((group) => group.tabs);
    expect(allTabs).toEqual([
      "chat",
      "overview",
      "sessions",
      "channels",
      "models",
      "mcp",
      "usage",
      "cron",
      "coreHub",
      "aiAgents",
      "skills",
      "config",
      "debug",
      "logs",
    ]);
  });

  it("enforces 100% unique icons across all 14 sidebar tabs (zero duplicate icons)", () => {
    const allTabs: Tab[] = TAB_GROUPS.flatMap((group) => group.tabs);
    const icons = allTabs.map((tab) => iconForTab(tab));

    expect(icons.length).toBe(14);
    const uniqueIcons = new Set(icons);
    expect(uniqueIcons.size).toBe(icons.length);
  });
});
