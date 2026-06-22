import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = {
  nativeCheck: vi.fn(),
  nativeRpc: vi.fn(),
  containerCheck: vi.fn(),
  containerRpc: vi.fn(),
};

import { detectSignalApiMode, signalRpcRequest, testing } from "./client-adapter.js";

describe("Signal client adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testing.setClientsForTests({
      nativeCheck: mocks.nativeCheck,
      nativeRpcRequest: mocks.nativeRpc,
      containerCheck: mocks.containerCheck,
      containerRpcRequest: mocks.containerRpc,
    });
  });
  afterEach(() => testing.resetClientsForTests());

  it("detects and routes to the container API", async () => {
    mocks.nativeCheck.mockResolvedValue({ ok: false });
    mocks.containerCheck.mockResolvedValue({ ok: true });
    mocks.containerRpc.mockResolvedValue({ timestamp: 1 });
    await expect(detectSignalApiMode("http://signal", 10)).resolves.toBe("container");
    await expect(
      signalRpcRequest("send", { message: "hello" }, {
        baseUrl: "http://signal",
        apiMode: "container",
      }),
    ).resolves.toEqual({ timestamp: 1 });
    expect(mocks.containerRpc).toHaveBeenCalledOnce();
  });
});
