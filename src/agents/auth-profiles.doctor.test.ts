import { describe, expect, it } from "vitest";
import { formatAuthDoctorHint } from "./auth-profiles/doctor.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

const EMPTY_STORE: AuthProfileStore = {
  version: 1,
  profiles: {},
};

describe("formatAuthDoctorHint", () => {
  it("guides removed qwen portal users to model studio onboarding", async () => {
    const hint = await formatAuthDoctorHint({
      store: EMPTY_STORE,
      provider: "qwen-portal",
    });

    expect(hint).toContain("onboard");
    expect(hint).toContain("modelstudio");
  });

  it("returns a string (possibly empty) for unknown providers", async () => {
    const hint = await formatAuthDoctorHint({
      store: EMPTY_STORE,
      provider: "some-unknown-provider",
    });

    // CB only has special hint logic for known providers like qwen-portal
    expect(typeof hint).toBe("string");
  });

  it("returns a string for anthropic provider", async () => {
    const hint = await formatAuthDoctorHint({
      store: EMPTY_STORE,
      provider: "anthropic",
    });

    expect(typeof hint).toBe("string");
  });

  it("returns a string for openai provider", async () => {
    const hint = await formatAuthDoctorHint({
      store: EMPTY_STORE,
      provider: "openai",
    });

    expect(typeof hint).toBe("string");
  });
});
