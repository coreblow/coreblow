import { describe, it, expect } from "vitest";
import {
  scheduleRestartSentinelWake,
  shouldWakeFromRestartSentinel,
} from "./server-restart-sentinel.js";

describe("server-restart-sentinel — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof scheduleRestartSentinelWake).toBe("function");
    expect(typeof shouldWakeFromRestartSentinel).toBe("function");
  });
});
