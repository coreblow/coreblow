import { describe, expect, it } from "vitest";
import {
  describeTalkSilenceTimeoutDefaults,
  TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM,
} from "./talk-defaults.js";

describe("talk silence timeout defaults", () => {
  it("defines per-platform silence timeout values", () => {
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.macos).toBeTypeOf("number");
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.android).toBeTypeOf("number");
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.ios).toBeTypeOf("number");
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.macos).toBeGreaterThan(0);
  });

  it("produces a human-readable defaults description", () => {
    const desc = describeTalkSilenceTimeoutDefaults();
    expect(desc).toContain("ms");
    expect(desc).toContain(String(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.macos));
    expect(desc).toContain(String(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.ios));
  });

  it("uses the same timeout for macOS and Android", () => {
    expect(TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.macos).toBe(
      TALK_SILENCE_TIMEOUT_MS_BY_PLATFORM.android,
    );
  });
});
