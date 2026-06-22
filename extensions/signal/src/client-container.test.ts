import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containerRestRequest, containerRpcRequest, testing } from "./client-container.js";

const fetchMock = vi.fn<typeof fetch>();

describe("Signal container client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    testing.setFetchForTests(fetchMock);
  });
  afterEach(() => testing.resetFetchForTests());

  it("maps native send RPC to the container REST API", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ timestamp: "1700000000000" }), { status: 200 }),
    );
    await expect(
      containerRpcRequest("send", {
        account: "+15550000000",
        recipient: ["uuid:abc"],
        message: "hello",
      }, { baseUrl: "http://127.0.0.1:8080" }),
    ).resolves.toEqual({ timestamp: 1700000000000 });
    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe("http://127.0.0.1:8080/v2/send");
    expect(String(request?.[1]?.body)).toContain('"recipients":["abc"]');
  });

  it("rejects HTTP errors with bounded context", async () => {
    fetchMock.mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(containerRestRequest("/v1/about", { baseUrl: "http://signal" })).rejects.toThrow(
      "Signal REST 403: denied",
    );
  });
});
