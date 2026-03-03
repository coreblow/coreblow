import { describe, it, expect } from "vitest";
import {
  createSessionsListTool,
} from "./sessions-list-tool.js";

describe("sessions-list-tool — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof createSessionsListTool).toBe("function");
  });
});
