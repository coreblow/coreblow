import { describe, expect, it } from "vitest";
import type { BrowserControlAuth } from "./browser-config.js";
import {
  DEFAULT_BROWSER_DEFAULT_PROFILE_NAME,
  DEFAULT_COREBLOW_BROWSER_ENABLED,
  parseBrowserHttpUrl,
} from "./browser-config.js";

describe("plugin-sdk browser-config", () => {
  it("keeps CoreBlow browser-config exports available", () => {
    const auth: BrowserControlAuth = { token: "test-token" };
    const parsed = parseBrowserHttpUrl("http://127.0.0.1:9222/", "browser.cdpUrl");

    expect(DEFAULT_COREBLOW_BROWSER_ENABLED).toBe(true);
    expect(DEFAULT_BROWSER_DEFAULT_PROFILE_NAME).toBe("coreblow");
    expect(auth.token).toBe("test-token");
    expect(parsed).toMatchObject({ port: 9222, normalized: "http://127.0.0.1:9222" });
  });
});
