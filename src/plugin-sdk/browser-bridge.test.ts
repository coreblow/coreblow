import { describe, expect, it } from "vitest";
import { resolveBrowserConfig } from "./browser-profiles.js";
import { startBrowserBridgeServer } from "./browser-bridge.js";

describe("browser bridge facade", () => {
  it("preserves the bridge loopback boundary", async () => {
    await expect(
      startBrowserBridgeServer({
        resolved: resolveBrowserConfig(undefined),
        host: "0.0.0.0",
        authToken: "test-token",
      }),
    ).rejects.toThrow("bridge server must bind to loopback host");
  });
});
