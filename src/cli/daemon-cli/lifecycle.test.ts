import { describe, it, expect } from "vitest";
import {
  runDaemonUninstall,
  runDaemonStart,
  runDaemonStop,
  runDaemonRestart,
} from "./lifecycle.js";

describe("lifecycle — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof runDaemonUninstall).toBe("function");
    expect(typeof runDaemonStart).toBe("function");
    expect(typeof runDaemonStop).toBe("function");
    expect(typeof runDaemonRestart).toBe("function");
  });
});
