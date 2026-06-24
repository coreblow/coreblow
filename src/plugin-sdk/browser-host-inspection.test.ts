import { describe, expect, it } from "vitest";
import {
  parseBrowserMajorVersion,
  resolveGoogleChromeExecutableForPlatform,
} from "./browser-host-inspection.js";

describe("browser host inspection", () => {
  it("parses Chromium-family major versions", () => {
    expect(parseBrowserMajorVersion("Google Chrome 126.0.6478.57")).toBe(126);
    expect(parseBrowserMajorVersion(undefined)).toBeNull();
  });

  it("returns no executable for unsupported platforms", () => {
    expect(resolveGoogleChromeExecutableForPlatform("aix")).toBeNull();
  });
});
