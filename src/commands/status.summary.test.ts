import { describe, it, expect } from "vitest";
import {
  redactSensitiveStatusSummary,
  getStatusSummary,
} from "./status.summary.js";

describe("status.summary — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof redactSensitiveStatusSummary).toBe("function");
    expect(typeof getStatusSummary).toBe("function");
  });
});
