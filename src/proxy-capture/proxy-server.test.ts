import { describe, expect, it } from "vitest";
import { isManagedProxyActive, startManagedDebugProxy } from "./proxy-server.js";

describe("proxy capture managed proxy", () => {
  it("detects managed proxy env", () => {
    expect(isManagedProxyActive({ COREBLOW_PROXY_ACTIVE: "1" })).toBe(true);
    expect(isManagedProxyActive({ COREBLOW_PROXY_ACTIVE: "0" })).toBe(false);
  });

  it("creates a managed proxy facade session", async () => {
    const proxy = await startManagedDebugProxy({
      dbPath: "/tmp/db.sqlite",
      blobDir: "/tmp/blobs",
      sessionId: "s1",
    });

    expect(proxy.session.sourceScope).toBe("coreblow");
    await proxy.close();
  });
});
