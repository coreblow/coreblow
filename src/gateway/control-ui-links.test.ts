import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveControlUiLinks } from "./control-ui-links.js";

const mocks = vi.hoisted(() => ({
  inspectBestEffortPrimaryTailnetIPv4: vi.fn(
    (): { tailnetIPv4: string | undefined; warning?: string } => ({ tailnetIPv4: undefined }),
  ),
  pickBestEffortPrimaryLanIPv4: vi.fn(() => undefined),
}));

vi.mock("../infra/network-discovery-display.js", () => ({
  inspectBestEffortPrimaryTailnetIPv4: mocks.inspectBestEffortPrimaryTailnetIPv4,
  pickBestEffortPrimaryLanIPv4: mocks.pickBestEffortPrimaryLanIPv4,
}));

describe("resolveControlUiLinks", () => {
  beforeEach(() => {
    mocks.inspectBestEffortPrimaryTailnetIPv4.mockReset();
    mocks.inspectBestEffortPrimaryTailnetIPv4.mockReturnValue({ tailnetIPv4: undefined });
    mocks.pickBestEffortPrimaryLanIPv4.mockReset();
    mocks.pickBestEffortPrimaryLanIPv4.mockReturnValue(undefined);
  });

  it("uses custom bind address and normalized UI base path", () => {
    expect(
      resolveControlUiLinks({
        port: 18789,
        bind: "custom",
        customBindHost: "192.168.1.100",
        basePath: "admin/",
      }),
    ).toEqual({
      httpUrl: "http://192.168.1.100:18789/admin/",
      wsUrl: "ws://192.168.1.100:18789/admin",
    });
  });

  it("uses tailnet address for tailnet bind", () => {
    mocks.inspectBestEffortPrimaryTailnetIPv4.mockReturnValue({ tailnetIPv4: "100.64.0.9" });

    expect(resolveControlUiLinks({ port: 18789, bind: "tailnet" })).toEqual({
      httpUrl: "http://100.64.0.9:18789/",
      wsUrl: "ws://100.64.0.9:18789",
    });
  });

  it("uses TLS schemes when TLS is enabled", () => {
    expect(resolveControlUiLinks({ port: 18789, tlsEnabled: true })).toEqual({
      httpUrl: "https://127.0.0.1:18789/",
      wsUrl: "wss://127.0.0.1:18789",
    });
  });

  it("falls back to loopback when no LAN address is available", () => {
    expect(resolveControlUiLinks({ port: 18789, bind: "lan" })).toEqual({
      httpUrl: "http://127.0.0.1:18789/",
      wsUrl: "ws://127.0.0.1:18789",
    });
  });
});
