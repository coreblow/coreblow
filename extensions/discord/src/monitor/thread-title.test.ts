/**
 * extensions/discord/src/monitor/thread-title.test.ts
 *
 * CoreBlow — Discord Extension: Thread-title Tests
 * Verifies Thread title generation and truncation.
 */
import { describe, expect, it } from "vitest";
import { normalizeGeneratedThreadTitle } from "./thread-title.js";

describe("normalizeGeneratedThreadTitle", () => {
  it("strips quotes and keeps the first non-empty line", () => {
    expect(normalizeGeneratedThreadTitle(' "Weekly Release Summary"\nExtra text')).toBe(
      "Weekly Release Summary",
    );
  });

  it("skips leading blank lines before selecting a title", () => {
    expect(normalizeGeneratedThreadTitle('\n\n "Weekly Release Summary"\nExtra text')).toBe(
      "Weekly Release Summary",
    );
  });

  it("skips leading markdown fence lines before selecting a title", () => {
    expect(normalizeGeneratedThreadTitle("```markdown\nWeekly Release Summary\n```")).toBe(
      "Weekly Release Summary",
    );
  });

  it("strips markdown bold wrappers", () => {
    expect(normalizeGeneratedThreadTitle("**Scaling Development Roadmap**")).toBe(
      "Scaling Development Roadmap",
    );
  });

  it("strips markdown underline wrappers", () => {
    expect(normalizeGeneratedThreadTitle('"__Weekly Release Summary__"')).toBe(
      "Weekly Release Summary",
    );
  });

  it("strips italic wrappers", () => {
    expect(normalizeGeneratedThreadTitle("*My Title*")).toBe("My Title");
    expect(normalizeGeneratedThreadTitle("_My Title_")).toBe("My Title");
  });

  it("strips strikethrough wrappers", () => {
    expect(normalizeGeneratedThreadTitle("~~Old Title~~")).toBe("Old Title");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeGeneratedThreadTitle("")).toBe("");
    expect(normalizeGeneratedThreadTitle("   ")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(normalizeGeneratedThreadTitle("Simple Title")).toBe("Simple Title");
  });
});
