import { describe, it, expect } from "vitest";
import {
  startGatewaySidecars,
} from "./server-startup.js";

describe("server-startup — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof startGatewaySidecars).toBe("function");
  });
});
