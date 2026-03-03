import { describe, it, expect } from "vitest";
import {
  normalizeSpeechProviderId,
  listSpeechProviders,
  getSpeechProvider,
  canonicalizeSpeechProviderId,
} from "./provider-registry.js";

describe("provider-registry — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof normalizeSpeechProviderId).toBe("function");
    expect(typeof listSpeechProviders).toBe("function");
    expect(typeof getSpeechProvider).toBe("function");
    expect(typeof canonicalizeSpeechProviderId).toBe("function");
  });
});
