import { describe, expect, it } from "vitest";
import { parseTtsDirectives } from "./directives.js";

describe("tts directives parity surface", () => {
  it("keeps directive parser importable", () => {
    expect(typeof parseTtsDirectives).toBe("function");
  });
});
