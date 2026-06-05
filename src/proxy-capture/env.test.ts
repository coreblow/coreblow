import { describe, expect, it } from "vitest";
import {
  COREBLOW_DEBUG_PROXY_ENABLED,
  COREBLOW_DEBUG_PROXY_SESSION_ID,
  buildDebugProxyChildEnv,
  resolveDebugProxyEnvConfig,
} from "./env.js";

describe("proxy capture env", () => {
  it("resolves enabled config and explicit session id", () => {
    const cfg = resolveDebugProxyEnvConfig({
      COREBLOW_STATE_DIR: "/tmp/coreblow-proxy-test",
      [COREBLOW_DEBUG_PROXY_ENABLED]: "1",
      [COREBLOW_DEBUG_PROXY_SESSION_ID]: "session-explicit",
    });

    expect(cfg.enabled).toBe(true);
    expect(cfg.sessionId).toBe("session-explicit");
    expect(cfg.sourceProcess).toBe("coreblow");
  });

  it("builds child env with proxy settings", () => {
    expect(
      buildDebugProxyChildEnv({
        proxyUrl: "http://127.0.0.1:8080",
        sessionId: "session-1",
        env: {},
      }),
    ).toMatchObject({
      COREBLOW_DEBUG_PROXY_ENABLED: "1",
      COREBLOW_DEBUG_PROXY_REQUIRE: "1",
      COREBLOW_DEBUG_PROXY_URL: "http://127.0.0.1:8080",
      COREBLOW_DEBUG_PROXY_SESSION_ID: "session-1",
    });
  });
});
