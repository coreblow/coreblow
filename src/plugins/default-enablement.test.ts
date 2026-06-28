import { describe, expect, it } from "vitest";
import { isPluginEnabledByDefaultForPlatform } from "./default-enablement.js";

describe("isPluginEnabledByDefaultForPlatform", () => {
  it("returns true when enabledByDefault is true regardless of platform", () => {
    expect(
      isPluginEnabledByDefaultForPlatform({ enabledByDefault: true }, "win32"),
    ).toBe(true);
  });

  it("returns true when the current platform is in enabledByDefaultOnPlatforms", () => {
    expect(
      isPluginEnabledByDefaultForPlatform(
        { enabledByDefaultOnPlatforms: ["darwin", "linux"] },
        "darwin",
      ),
    ).toBe(true);
  });

  it("returns false when the current platform is not listed", () => {
    expect(
      isPluginEnabledByDefaultForPlatform(
        { enabledByDefaultOnPlatforms: ["linux"] },
        "darwin",
      ),
    ).toBe(false);
  });

  it("returns false when neither field is set", () => {
    expect(isPluginEnabledByDefaultForPlatform({}, "darwin")).toBe(false);
  });

  it("defaults to process.platform when no platform argument is given", () => {
    expect(
      isPluginEnabledByDefaultForPlatform({ enabledByDefault: true }),
    ).toBe(true);
  });
});
