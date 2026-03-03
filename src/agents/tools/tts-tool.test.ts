import { describe, it, expect } from "vitest";
import {
  createTtsTool,
} from "./tts-tool.js";

describe("tts-tool — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof createTtsTool).toBe("function");
  });
});
