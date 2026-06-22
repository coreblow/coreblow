import { describe, expect, it } from "vitest";
import { nextcloudTalkGatewayAdapter } from "./gateway.js";

describe("nextcloud-talk lifecycle", () => {
  it("rejects startup when credentials are incomplete", async () => {
    await expect(nextcloudTalkGatewayAdapter?.startAccount?.({
      accountId: "default",
      account: { accountId: "default", enabled: true, baseUrl: "", secret: "", secretSource: "none", config: {} },
      cfg: {},
      abortSignal: new AbortController().signal,
      runtime: undefined,
      setStatus: () => {},
    } as never)).rejects.toThrow("missing secret or baseUrl");
  });
});
