import { describe, it, expect } from "vitest";
import {
  registerAgentCommands,
} from "./register.agent.js";

describe("register.agent — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof registerAgentCommands).toBe("function");
  });
});
