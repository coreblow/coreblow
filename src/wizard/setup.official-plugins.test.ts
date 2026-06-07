import { describe, expect, it } from "vitest";
import {
  resolveOfficialPluginOnboardingInstallEntries,
  testing,
} from "./setup.official-plugins.js";

describe("resolveOfficialPluginOnboardingInstallEntries", () => {
  it("returns no optional official installs until CoreBlow catalog runtime is wired", () => {
    expect(resolveOfficialPluginOnboardingInstallEntries({ config: {} })).toEqual([]);
  });
});

describe("formatInstallHint", () => {
  it("describes dual-source npm-default installs as npm first", () => {
    expect(
      testing.formatInstallHint({
        corehubSpec: "corehub:@coreblow/diagnostics-otel",
        npmSpec: "@coreblow/diagnostics-otel",
        defaultChoice: "npm",
      }),
    ).toBe("npm, with CoreHub fallback");
  });
});
