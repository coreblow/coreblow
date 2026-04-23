import { describe, it, expect } from "vitest";
import {
  cleanupSessionStateForTest,
} from "./session-state-cleanup.js";

describe("session-state-cleanup — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof cleanupSessionStateForTest).toBe("function");
  });
});
