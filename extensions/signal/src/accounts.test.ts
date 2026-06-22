import { describe, expect, it } from "vitest";
import { resolveSignalAccount } from "./accounts.js";

describe("Signal accounts", () => {
  it("merges channel defaults and account overrides", () => {
    const account = resolveSignalAccount({
      cfg: {
        channels: {
          signal: {
            httpHost: "127.0.0.2",
            apiMode: "container",
            accounts: { work: { account: "+15550001111", httpPort: 9090 } },
          },
        },
      },
      accountId: "work",
    });
    expect(account).toMatchObject({
      accountId: "work",
      baseUrl: "http://127.0.0.2:9090",
      apiMode: "container",
      configured: true,
    });
  });
});
