import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testing } from "./client-adapter.js";
import { sendMessageSignal } from "./send.js";

const rpcMock = vi.fn();

describe("Signal send", () => {
  beforeEach(() => {
    rpcMock.mockReset().mockResolvedValue({ timestamp: 123 });
    testing.setClientsForTests({ containerRpcRequest: rpcMock });
  });
  afterEach(() => testing.resetClientsForTests());

  it("routes explicit container mode and canonical recipient payload", async () => {
    await expect(
      sendMessageSignal("signal:+15550001111", "hello", {
        cfg: {
          channels: {
            signal: { account: "+15550009999", httpUrl: "http://signal", apiMode: "container" },
          },
        },
      }),
    ).resolves.toEqual({ messageId: "123", timestamp: 123 });
    expect(rpcMock).toHaveBeenCalledWith(
      "send",
      expect.objectContaining({ recipient: ["+15550001111"] }),
      expect.objectContaining({ apiMode: "container" }),
    );
  });
});
