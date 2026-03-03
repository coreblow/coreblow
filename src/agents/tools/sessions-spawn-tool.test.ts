import { describe, it, expect } from "vitest";
import {
  createSessionsSpawnTool,
} from "./sessions-spawn-tool.js";

describe("sessions-spawn-tool — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof createSessionsSpawnTool).toBe("function");
  });
});
