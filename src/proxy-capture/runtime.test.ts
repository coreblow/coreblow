import { afterEach, describe, expect, it } from "vitest";
import { createDebugProxyRuntime, recordDebugProxyRequest } from "./runtime.js";
import { clearCaptureStoreForTests, listCaptureEvents } from "./store.sqlite.js";

describe("proxy capture runtime", () => {
  afterEach(() => clearCaptureStoreForTests());

  it("records request events when enabled", () => {
    const runtime = createDebugProxyRuntime({
      COREBLOW_DEBUG_PROXY_ENABLED: "1",
      COREBLOW_DEBUG_PROXY_SESSION_ID: "s1",
      COREBLOW_STATE_DIR: "/tmp/coreblow-proxy-test",
    });

    recordDebugProxyRequest({
      runtime,
      method: "POST",
      host: "api.example.com",
      path: "/v1/messages",
      meta: { provider: "anthropic" },
    });

    expect(listCaptureEvents("s1")).toHaveLength(1);
    runtime.close();
  });
});
