import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import React from "react";
import { renderToString } from "ink";
import { VERSION } from "../../version.js";
import { abbreviateHomePath, WelcomeHero } from "./WelcomeHero.js";

function stripAnsi(text: string): string {
  // Strip CSI escape sequences cleanly for layout content assertions.
  const esc = String.fromCharCode(27);
  const ansiRegex = new RegExp(`${esc}\\[[0-9;]*m`, "g");
  return text.replace(ansiRegex, "");
}

describe("WelcomeHero component", () => {
  const sampleWorkspace = path.join(os.homedir(), "coreblow");

  it("abbreviates paths inside the home directory cleanly", () => {
    expect(abbreviateHomePath(sampleWorkspace)).toBe("~/coreblow");
    expect(abbreviateHomePath(os.homedir())).toBe("~");
  });

  it("renders wide left-aligned layout with 8-row mascot when columns = 100", () => {
    const raw = renderToString(
      React.createElement(WelcomeHero, {
        model: "anthropic/claude-3-7-sonnet",
        uiMode: "pro",
        backendBadge: "Local",
        columns: 100,
        cwd: sampleWorkspace,
      }),
    );
    const plain = stripAnsi(raw);
    const lines = plain.split("\n").filter((l) => l.trim().length > 0);

    expect(plain).toContain(`CoreBlow v${VERSION}`);
    expect(plain).toContain("claude-3-7-sonnet");
    expect(plain).toContain("Local");
    expect(plain).toContain("pro");
    expect(plain).toContain("●");
    expect(plain).toContain("~/coreblow");
    expect(plain).toContain("/model · /sessions · /desktop · /pool · /help");
    expect(lines.length).toBe(8);
    expect(plain).not.toContain("╭");
    expect(plain).not.toContain("╰");
  });

  it("renders standard layout with Gateway backend status when columns = 74", () => {
    const raw = renderToString(
      React.createElement(WelcomeHero, {
        model: "anthropic/claude-3-7-sonnet",
        uiMode: "basic",
        backendBadge: "Gateway :18789",
        columns: 74,
        cwd: sampleWorkspace,
      }),
    );
    const plain = stripAnsi(raw);
    const lines = plain.split("\n").filter((l) => l.trim().length > 0);

    expect(plain).toContain(`CoreBlow v${VERSION}`);
    expect(plain).toContain("claude-3-7-sonnet · Gateway :18789 · basic ●");
    expect(plain).toContain("~/coreblow");
    expect(plain).toContain("/model · /sessions · /desktop · /pool · /help");
    expect(lines.length).toBe(8);
  });

  it("renders compact 5-row mascot and wraps inline commands cleanly when columns = 58", () => {
    const raw = renderToString(
      React.createElement(WelcomeHero, {
        model: "openai/gpt-4o",
        uiMode: "pro",
        backendBadge: "Local",
        columns: 58,
        cwd: sampleWorkspace,
      }),
    );
    const plain = stripAnsi(raw);
    const lines = plain.split("\n").filter((l) => l.trim().length > 0);

    expect(plain).toContain(`CoreBlow v${VERSION}`);
    expect(plain).toContain("gpt-4o · Local · pro ●");
    expect(plain).toContain("~/coreblow");
    expect(plain).toContain("/model · /sessions · /desktop");
    expect(plain).toContain("/pool · /help");
    expect(lines.length).toBe(5);
  });
});
