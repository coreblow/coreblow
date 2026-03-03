import { describe, it, expect } from "vitest";
import {
  gatewayStatusCommand,
} from "./gateway-status.js";

describe("gateway-status — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof gatewayStatusCommand).toBe("function");
  });
});
