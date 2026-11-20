import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "ink";
import { WelcomeHero } from "./WelcomeHero.js";

describe("WelcomeHero component", () => {
  it("renders wide layout with rounded tags when columns >= 84", () => {
    const output = renderToString(
      React.createElement(WelcomeHero, {
        model: "anthropic/claude-3-7-sonnet",
        uiMode: "pro",
        backendBadge: "Local",
        columns: 90,
      }),
    );

    expect(output).toContain("CORE");
    expect(output).toContain("BLOW");
    expect(output).toContain("AI Development CLI");
    expect(output).toContain("claude-3-7-sonnet");
    expect(output).toContain("pro");
    expect(output).toContain("stable");
    expect(output).toContain("/model");
    expect(output).toContain("Switch model");
    expect(output).toContain("/sessions");
    expect(output).toContain("Resume session");
    expect(output).toContain("/pool");
    expect(output).toContain("Keys & agents");
    expect(output).toContain("/help");
    expect(output).toContain("Commands & tips");
  });

  it("renders medium layout with inline [ /cmd ] tags when columns between 68 and 83", () => {
    const output = renderToString(
      React.createElement(WelcomeHero, {
        model: "anthropic/claude-3-7-sonnet",
        uiMode: "basic",
        backendBadge: "Gateway :18789",
        columns: 75,
      }),
    );

    expect(output).toContain("CORE");
    expect(output).toContain("BLOW");
    expect(output).toContain("AI Development CLI");
    expect(output).toContain("claude-3-7-sonnet");
    expect(output).toContain("basic");
    expect(output).toContain("stable");
    expect(output).toContain("[ /model ]");
    expect(output).toContain("Switch model");
    expect(output).toContain("[ /sessions ]");
    expect(output).toContain("[ /pool ]");
    expect(output).toContain("[ /help ]");
  });

  it("renders narrow layout with compact header and 2x2 grid when columns < 64", () => {
    const output = renderToString(
      React.createElement(WelcomeHero, {
        model: "openai/gpt-4o",
        uiMode: "pro",
        backendBadge: "Local",
        columns: 60,
      }),
    );

    expect(output).toContain("◆ COREBLOW");
    expect(output).toContain("AI Development CLI");
    expect(output).toContain("gpt-4o");
    expect(output).toContain("pro");
    expect(output).toContain("stable");
    expect(output).toContain("[ /model ]");
    expect(output).toContain("Switch model");
    expect(output).toContain("[ /sessions ]");
    expect(output).toContain("[ /pool ]");
    expect(output).toContain("[ /help ]");
  });
});
