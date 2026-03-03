import { describe, it, expect } from "vitest";
import {
  handleSubagentsAgentsAction,
} from "./action-agents.js";

describe("action-agents — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof handleSubagentsAgentsAction).toBe("function");
  });
});
