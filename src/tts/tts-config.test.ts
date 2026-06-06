import { describe, expect, it } from "vitest";
import { resolveConfiguredTtsMode } from "./tts-config.js";

describe("tts config parity surface", () => {
  it("defaults to final mode", () => {
    expect(resolveConfiguredTtsMode({} as never)).toBe("final");
  });
});
