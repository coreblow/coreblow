import { describe, it, expect } from "vitest";
import {
  getRawSessionAppendMessage,
  installSessionToolResultGuard,
} from "./session-tool-result-guard.js";

describe("session-tool-result-guard — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof getRawSessionAppendMessage).toBe("function");
    expect(typeof installSessionToolResultGuard).toBe("function");
  });
});
