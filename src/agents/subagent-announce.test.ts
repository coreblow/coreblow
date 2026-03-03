import { describe, it, expect } from "vitest";
import {
  buildSubagentSystemPrompt,
  runSubagentAnnounceFlow,
} from "./subagent-announce.js";

describe("subagent-announce — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof buildSubagentSystemPrompt).toBe("function");
    expect(typeof runSubagentAnnounceFlow).toBe("function");
  });
});
