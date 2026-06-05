import { describe, expect, it } from "vitest";
import { COREBLOW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY } from "./proxy-server.js";

describe("proxy capture managed proxy env constants", () => {
  it("uses CoreBlow-native managed proxy override naming", () => {
    expect(COREBLOW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY).toBe(
      "COREBLOW_DEBUG_PROXY_ALLOW_DIRECT_CONNECT_WITH_MANAGED_PROXY",
    );
  });
});
