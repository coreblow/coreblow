import { describe, expect, it } from "vitest";
import { resolveHostedPluginSurfaceUrl } from "./hosted-plugin-surface-url.js";

describe("resolveHostedPluginSurfaceUrl", () => {
  it("prefers forwarded host over request host behind an HTTPS proxy", () => {
    expect(
      resolveHostedPluginSurfaceUrl({
        port: 18789,
        requestHost: "10.0.0.2:18789",
        forwardedHost: "gateway.example.com",
        forwardedProto: "https",
      }),
    ).toBe("https://gateway.example.com:443");
  });

  it("keeps explicit forwarded host ports", () => {
    expect(
      resolveHostedPluginSurfaceUrl({
        port: 18789,
        requestHost: "10.0.0.2:18789",
        forwardedHost: "gateway.example.com:9443",
        forwardedProto: "https",
      }),
    ).toBe("https://gateway.example.com:9443");
  });

  it("falls back to request host when no forwarded host is available", () => {
    expect(
      resolveHostedPluginSurfaceUrl({
        port: 18789,
        requestHost: "gateway.internal:8181",
      }),
    ).toBe("http://gateway.internal:8181");
  });
});
