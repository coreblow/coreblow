import { describe, expect, it } from "vitest";
import { parseBrowserHttpUrl, redactCdpUrl } from "./browser-cdp.js";
import { resolveBrowserControlAuth } from "./browser-control-auth.js";
import {
  DEFAULT_BROWSER_DEFAULT_PROFILE_NAME,
  DEFAULT_COREBLOW_BROWSER_ENABLED,
  resolveBrowserConfig,
} from "./browser-profiles.js";

describe("plugin-sdk browser subpaths", () => {
  it("keeps CoreBlow browser profile helpers on the narrow subpath", () => {
    expect(DEFAULT_COREBLOW_BROWSER_ENABLED).toBe(true);
    expect(DEFAULT_BROWSER_DEFAULT_PROFILE_NAME).toBe("coreblow");
    expect(resolveBrowserConfig).toBeTypeOf("function");
  });

  it("parses and redacts CDP URLs on the dedicated subpath", () => {
    const parsed = parseBrowserHttpUrl("http://user:pass@127.0.0.1:9222/", "browser.cdpUrl");
    expect(parsed.port).toBe(9222);
    expect(redactCdpUrl(parsed.normalized)).toBe("http://127.0.0.1:9222");
  });

  it("exposes browser control authentication", () => {
    expect(resolveBrowserControlAuth).toBeTypeOf("function");
  });
});
