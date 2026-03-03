import { describe, expect, it } from "vitest";
import {
  listChannelSetupWizardAdapters,
  getChannelSetupWizardAdapter,
} from "./registry.js";

describe("listChannelSetupWizardAdapters()", () => {
  it("is a function", () => {
    expect(typeof listChannelSetupWizardAdapters).toBe("function");
  });

  it("returns an array", () => {
    const result = listChannelSetupWizardAdapters();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("getChannelSetupWizardAdapter()", () => {
  it("is a function", () => {
    expect(typeof getChannelSetupWizardAdapter).toBe("function");
  });

  it("returns null or object for unknown plugin", () => {
    const result = getChannelSetupWizardAdapter("unknown-channel");
    expect(result === null || result === undefined || typeof result === "object").toBe(true);
  });

  it("does not throw for empty string", () => {
    expect(() => getChannelSetupWizardAdapter("")).not.toThrow();
  });
});
