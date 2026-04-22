import { describe, expect, it } from "vitest";
import { buildCompactionSummarizationInstructions } from "./compaction.js";

describe("compaction identifier policy", () => {
  it("defaults to strict identifier preservation", () => {
    const built = buildCompactionSummarizationInstructions();
    expect(built).toContain("Preserve all opaque identifiers exactly as written");
    expect(built).toContain("UUIDs");
  });

  it("can disable identifier preservation with off policy", () => {
    const built = buildCompactionSummarizationInstructions(undefined, {
      identifierPolicy: "off",
    });
    expect(built).toBeUndefined();
  });

  it("supports custom identifier instructions", () => {
    const built = buildCompactionSummarizationInstructions(undefined, {
      identifierPolicy: "custom",
      identifierInstructions: "Keep ticket IDs unchanged.",
    });
    expect(built).toContain("Keep ticket IDs unchanged.");
    expect(built).not.toContain("Preserve all opaque identifiers exactly as written");
  });

  it("falls back to strict text when custom policy is missing instructions", () => {
    const built = buildCompactionSummarizationInstructions(undefined, {
      identifierPolicy: "custom",
      identifierInstructions: "   ",
    });
    expect(built).toContain("Preserve all opaque identifiers exactly as written");
  });

  it("keeps custom focus text when identifier policy is off", () => {
    const built = buildCompactionSummarizationInstructions("Track release blockers.", {
      identifierPolicy: "off",
    });
    expect(built).toBe("Additional focus:\nTrack release blockers.");
  });

  it("combines strict preservation with custom focus text", () => {
    const built = buildCompactionSummarizationInstructions("Focus on auth flows.", {
      identifierPolicy: "strict",
    });
    expect(built).toContain("Preserve all opaque identifiers exactly as written");
    expect(built).toContain("Focus on auth flows.");
  });

  it("combines custom instructions with custom focus text", () => {
    const built = buildCompactionSummarizationInstructions("Focus on performance.", {
      identifierPolicy: "custom",
      identifierInstructions: "Keep PR numbers like #123.",
    });
    expect(built).toContain("Keep PR numbers like #123.");
    expect(built).toContain("Focus on performance.");
  });

  it("returns undefined when policy is off and no custom focus text", () => {
    const built = buildCompactionSummarizationInstructions(undefined, {
      identifierPolicy: "off",
    });
    expect(built).toBeUndefined();
  });

  it("returns undefined when no args provided — wait, strict is default — has content", () => {
    const built = buildCompactionSummarizationInstructions();
    expect(typeof built).toBe("string");
    expect((built as string).length).toBeGreaterThan(0);
  });

  it("trims whitespace-only custom focus text", () => {
    const built = buildCompactionSummarizationInstructions("   ", {
      identifierPolicy: "strict",
    });
    // Whitespace-only custom focus → treated as empty, only identifier preservation remains
    expect(built).toContain("Preserve all opaque identifiers exactly as written");
    expect(built).not.toContain("Additional focus");
  });
});
