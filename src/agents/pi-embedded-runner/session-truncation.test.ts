import { describe, it, expect } from "vitest";
import {
  truncateSessionAfterCompaction,
} from "./session-truncation.js";

describe("session-truncation — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof truncateSessionAfterCompaction).toBe("function");
  });
});
