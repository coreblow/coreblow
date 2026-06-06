import { describe, expect, it } from "vitest";
import { detectInlineEvalArgv } from "./risks.js";

describe("command-analysis lazy command explainer", () => {
  it("detects policy risks without loading rich parser dependencies", () => {
    expect(detectInlineEvalArgv(["python3", "-c", "print(1)"])?.flag).toBe("-c");
  });
});
